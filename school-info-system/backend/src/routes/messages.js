const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');
const { encryptionService } = require('../utils/encryption');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/messages
 * Get messages for the current user
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    confidentialityLevel,
    isUrgent,
    startDate,
    endDate,
    senderId
  } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  // Build where clause for messages where user is recipient
  const whereClause = {
    recipients: {
      some: {
        recipientId: req.user.id
      }
    }
  };

  // Add filters
  if (confidentialityLevel) {
    whereClause.confidentialityLevel = parseInt(confidentialityLevel);
  }
  
  if (isUrgent !== undefined) {
    whereClause.isUrgent = isUrgent === 'true';
  }
  
  if (senderId) {
    whereClause.senderId = parseInt(senderId);
  }

  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt.gte = new Date(startDate);
    if (endDate) whereClause.createdAt.lte = new Date(endDate);
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            department: true
          }
        },
        recipients: {
          include: {
            recipient: {
              select: {
                id: true,
                username: true,
                fullName: true,
                role: true
              }
            }
          }
        },
        reads: {
          where: { userId: req.user.id },
          select: { readAt: true }
        }
      },
      orderBy: [
        { isUrgent: 'desc' },
        { createdAt: 'desc' }
      ],
      skip: offset,
      take: limitNum
    }),
    prisma.message.count({ where: whereClause })
  ]);

  // Decrypt message content
  const decryptedMessages = messages.map(message => {
    try {
      let content;
      if (typeof message.contentEncrypted === 'string') {
        // If it's a simple string, treat as non-encrypted (for backward compatibility)
        content = message.contentEncrypted;
      } else {
        // Decrypt the message content
        content = encryptionService.decrypt(message.contentEncrypted);
      }

      return {
        id: message.id,
        content,
        confidentialityLevel: message.confidentialityLevel,
        isUrgent: message.isUrgent,
        audioDuration: message.audioDuration,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        sender: message.sender,
        recipients: message.recipients.map(r => r.recipient),
        isRead: message.reads.length > 0,
        readAt: message.reads[0]?.readAt || null,
        metadata: message.metadata
      };
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return {
        ...message,
        content: '[メッセージの復号化に失敗しました]',
        decryptionError: true
      };
    }
  });

  res.json({
    success: true,
    messages: decryptedMessages,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
}));

/**
 * GET /api/messages/sent
 * Get messages sent by the current user
 */
router.get('/sent', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { senderId: req.user.id },
      include: {
        recipients: {
          include: {
            recipient: {
              select: {
                id: true,
                username: true,
                fullName: true,
                role: true
              }
            }
          }
        },
        reads: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limitNum
    }),
    prisma.message.count({ where: { senderId: req.user.id } })
  ]);

  // Decrypt message content for sent messages
  const decryptedMessages = messages.map(message => {
    try {
      let content;
      if (typeof message.contentEncrypted === 'string') {
        content = message.contentEncrypted;
      } else {
        content = encryptionService.decrypt(message.contentEncrypted);
      }

      return {
        id: message.id,
        content,
        confidentialityLevel: message.confidentialityLevel,
        isUrgent: message.isUrgent,
        audioDuration: message.audioDuration,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        recipients: message.recipients.map(r => r.recipient),
        reads: message.reads,
        readCount: message.reads.length,
        totalRecipients: message.recipients.length,
        metadata: message.metadata
      };
    } catch (error) {
      console.error('Failed to decrypt sent message:', error);
      return {
        ...message,
        content: '[メッセージの復号化に失敗しました]',
        decryptionError: true
      };
    }
  });

  res.json({
    success: true,
    messages: decryptedMessages,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
}));

/**
 * POST /api/messages
 * Create a new message
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    content,
    recipientIds,
    confidentialityLevel = 1,
    isUrgent = false,
    audioDuration,
    metadata = {}
  } = req.body;

  // Validation
  if (!content || content.trim().length === 0) {
    throw new AppError('Message content is required', 400, 'MISSING_CONTENT');
  }

  if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    throw new AppError('At least one recipient is required', 400, 'MISSING_RECIPIENTS');
  }

  if (![1, 2, 3].includes(confidentialityLevel)) {
    throw new AppError('Invalid confidentiality level', 400, 'INVALID_CONFIDENTIALITY_LEVEL');
  }

  // Validate recipients exist and are active
  const recipients = await prisma.user.findMany({
    where: {
      id: { in: recipientIds },
      isActive: true
    },
    select: { id: true, username: true, role: true }
  });

  if (recipients.length !== recipientIds.length) {
    throw new AppError('Some recipients are invalid or inactive', 400, 'INVALID_RECIPIENTS');
  }

  // Check permissions for high confidentiality messages
  if (confidentialityLevel === 3 && !['ADMIN', 'STAFF'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions for confidentiality level 3', 403, 'INSUFFICIENT_PERMISSIONS');
  }

  // Encrypt message content based on confidentiality level
  const encryptedContent = encryptionService.encryptByLevel(content, confidentialityLevel);

  // Calculate expiry date based on confidentiality level
  let expiresAt = null;
  if (confidentialityLevel === 3) {
    // Level 3: 3 months
    expiresAt = new Date(Date.now() + 3 * 30 * 24 * 60 * 60 * 1000);
  } else if (confidentialityLevel === 2) {
    // Level 2: 6 months
    expiresAt = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
  } else {
    // Level 1: 1 year
    expiresAt = new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000);
  }

  // Create message with transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create message
    const message = await tx.message.create({
      data: {
        senderId: req.user.id,
        contentEncrypted: encryptedContent,
        encryptionKeyId: encryptedContent.keyId,
        confidentialityLevel,
        isUrgent,
        audioDuration,
        expiresAt,
        metadata: {
          ...metadata,
          deviceInfo: req.get('User-Agent'),
          ipAddress: req.ip,
          timestamp: new Date().toISOString()
        }
      }
    });

    // Create recipient records
    const recipientRecords = await Promise.all(
      recipientIds.map(recipientId =>
        tx.messageRecipient.create({
          data: {
            messageId: message.id,
            recipientId,
            recipientType: 'USER'
          }
        })
      )
    );

    return { message, recipientRecords };
  });

  // Fetch complete message data for response
  const completeMessage = await prisma.message.findUnique({
    where: { id: result.message.id },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          department: true
        }
      },
      recipients: {
        include: {
          recipient: {
            select: {
              id: true,
              username: true,
              fullName: true,
              role: true
            }
          }
        }
      }
    }
  });

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: {
      id: completeMessage.id,
      content, // Return original unencrypted content
      confidentialityLevel: completeMessage.confidentialityLevel,
      isUrgent: completeMessage.isUrgent,
      audioDuration: completeMessage.audioDuration,
      createdAt: completeMessage.createdAt,
      expiresAt: completeMessage.expiresAt,
      sender: completeMessage.sender,
      recipients: completeMessage.recipients.map(r => r.recipient)
    }
  });
}));

/**
 * GET /api/messages/:id
 * Get a specific message by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const messageId = parseInt(req.params.id);

  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      OR: [
        { senderId: req.user.id }, // User is sender
        { 
          recipients: {
            some: { recipientId: req.user.id }
          }
        } // User is recipient
      ]
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          department: true
        }
      },
      recipients: {
        include: {
          recipient: {
            select: {
              id: true,
              username: true,
              fullName: true,
              role: true
            }
          }
        }
      },
      reads: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        }
      }
    }
  });

  if (!message) {
    throw new AppError('Message not found or access denied', 404, 'MESSAGE_NOT_FOUND');
  }

  // Decrypt content
  let content;
  try {
    if (typeof message.contentEncrypted === 'string') {
      content = message.contentEncrypted;
    } else {
      content = encryptionService.decrypt(message.contentEncrypted);
    }
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    content = '[メッセージの復号化に失敗しました]';
  }

  res.json({
    success: true,
    message: {
      id: message.id,
      content,
      confidentialityLevel: message.confidentialityLevel,
      isUrgent: message.isUrgent,
      audioDuration: message.audioDuration,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      expiresAt: message.expiresAt,
      sender: message.sender,
      recipients: message.recipients.map(r => r.recipient),
      reads: message.reads,
      metadata: message.metadata
    }
  });
}));

/**
 * POST /api/messages/:id/read
 * Mark a message as read
 */
router.post('/:id/read', asyncHandler(async (req, res) => {
  const messageId = parseInt(req.params.id);

  // Verify user has access to this message
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      recipients: {
        some: { recipientId: req.user.id }
      }
    }
  });

  if (!message) {
    throw new AppError('Message not found or access denied', 404, 'MESSAGE_NOT_FOUND');
  }

  // Create or update read record
  const readRecord = await prisma.messageRead.upsert({
    where: {
      messageId_userId: {
        messageId,
        userId: req.user.id
      }
    },
    update: {
      readAt: new Date()
    },
    create: {
      messageId,
      userId: req.user.id,
      readAt: new Date()
    }
  });

  res.json({
    success: true,
    message: 'Message marked as read',
    readAt: readRecord.readAt
  });
}));

/**
 * DELETE /api/messages/:id
 * Delete a message (sender only or admin)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const messageId = parseInt(req.params.id);

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true }
  });

  if (!message) {
    throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
  }

  // Check permissions: sender or admin
  if (message.senderId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new AppError('Insufficient permissions to delete this message', 403, 'INSUFFICIENT_PERMISSIONS');
  }

  // Delete message (cascade will handle recipients and reads)
  await prisma.message.delete({
    where: { id: messageId }
  });

  res.json({
    success: true,
    message: 'Message deleted successfully'
  });
}));

/**
 * GET /api/messages/stats/summary
 * Get message statistics for current user
 */
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [
    unreadCount,
    totalReceived,
    totalSent,
    urgentCount,
    confidentialCount
  ] = await Promise.all([
    // Unread messages count
    prisma.message.count({
      where: {
        recipients: {
          some: { recipientId: userId }
        },
        reads: {
          none: { userId }
        }
      }
    }),
    // Total received messages
    prisma.message.count({
      where: {
        recipients: {
          some: { recipientId: userId }
        }
      }
    }),
    // Total sent messages
    prisma.message.count({
      where: { senderId: userId }
    }),
    // Urgent unread messages
    prisma.message.count({
      where: {
        recipients: {
          some: { recipientId: userId }
        },
        reads: {
          none: { userId }
        },
        isUrgent: true
      }
    }),
    // Confidential messages (level 2 & 3)
    prisma.message.count({
      where: {
        recipients: {
          some: { recipientId: userId }
        },
        confidentialityLevel: {
          gte: 2
        }
      }
    })
  ]);

  res.json({
    success: true,
    stats: {
      unreadCount,
      totalReceived,
      totalSent,
      urgentCount,
      confidentialCount
    }
  });
}));

module.exports = router;