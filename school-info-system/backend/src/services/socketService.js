const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class SocketService {
  constructor() {
    this.io = null;
    this.redis = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
  }

  initialize(io, redis) {
    this.io = io;
    this.redis = redis;
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        // Authenticate socket connection
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            username: true,
            role: true,
            isActive: true
          }
        });

        if (!user || !user.isActive) {
          return next(new Error('Invalid user or user is inactive'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`User ${socket.user.username} (${socket.userId}) connected via socket ${socket.id}`);
      
      // Track user connection
      this.connectedUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, socket.userId);

      // Join user to their personal room
      socket.join(`user_${socket.userId}`);

      // Join user to role-based rooms
      socket.join(`role_${socket.user.role}`);

      // Emit user online status
      socket.broadcast.emit('user_online', {
        userId: socket.userId,
        username: socket.user.username
      });

      // Handle message sending
      socket.on('send_message', async (data) => {
        try {
          await this.handleSendMessage(socket, data);
        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle message reading
      socket.on('mark_read', async (data) => {
        try {
          await this.handleMarkRead(socket, data);
        } catch (error) {
          console.error('Mark read error:', error);
          socket.emit('error', { message: 'Failed to mark message as read' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        this.handleTyping(socket, data, true);
      });

      socket.on('typing_stop', (data) => {
        this.handleTyping(socket, data, false);
      });

      // Handle voice recording status
      socket.on('voice_recording_start', (data) => {
        this.handleVoiceRecording(socket, data, true);
      });

      socket.on('voice_recording_stop', (data) => {
        this.handleVoiceRecording(socket, data, false);
      });

      // Handle real-time notifications
      socket.on('subscribe_notifications', () => {
        socket.join(`notifications_${socket.userId}`);
        socket.emit('subscribed', { type: 'notifications' });
      });

      // Handle user presence updates
      socket.on('update_presence', (data) => {
        this.handlePresenceUpdate(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`User ${socket.user.username} (${socket.userId}) disconnected: ${reason}`);
        
        // Remove from tracking
        this.connectedUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);

        // Emit user offline status
        socket.broadcast.emit('user_offline', {
          userId: socket.userId,
          username: socket.user.username
        });
      });
    });
  }

  async handleSendMessage(socket, data) {
    const { recipientIds, content, confidentialityLevel = 1, isUrgent = false } = data;

    // Validate data
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      socket.emit('message_error', { error: 'Recipients are required' });
      return;
    }

    if (!content || content.trim().length === 0) {
      socket.emit('message_error', { error: 'Message content is required' });
      return;
    }

    // Emit real-time message to recipients
    const messageData = {
      senderId: socket.userId,
      senderName: socket.user.username,
      content,
      confidentialityLevel,
      isUrgent,
      timestamp: new Date().toISOString(),
      recipientIds
    };

    // Send to each recipient if they're online
    recipientIds.forEach(recipientId => {
      const recipientSocketId = this.connectedUsers.get(recipientId);
      if (recipientSocketId) {
        this.io.to(`user_${recipientId}`).emit('new_message', messageData);
      }
    });

    // Send confirmation to sender
    socket.emit('message_sent', {
      timestamp: messageData.timestamp,
      recipientIds
    });

    // If urgent message, send push notification
    if (isUrgent) {
      this.sendUrgentNotification(recipientIds, messageData);
    }
  }

  async handleMarkRead(socket, data) {
    const { messageId } = data;

    if (!messageId) {
      socket.emit('read_error', { error: 'Message ID is required' });
      return;
    }

    try {
      // Create read record in database
      await prisma.messageRead.upsert({
        where: {
          messageId_userId: {
            messageId: parseInt(messageId),
            userId: socket.userId
          }
        },
        update: {
          readAt: new Date()
        },
        create: {
          messageId: parseInt(messageId),
          userId: socket.userId,
          readAt: new Date()
        }
      });

      // Get message to find sender
      const message = await prisma.message.findUnique({
        where: { id: parseInt(messageId) },
        select: { senderId: true }
      });

      if (message) {
        // Notify sender that message was read
        const senderSocketId = this.connectedUsers.get(message.senderId);
        if (senderSocketId) {
          this.io.to(`user_${message.senderId}`).emit('message_read', {
            messageId,
            readBy: socket.userId,
            readByName: socket.user.username,
            readAt: new Date().toISOString()
          });
        }
      }

      socket.emit('read_confirmed', { messageId });
    } catch (error) {
      console.error('Mark read error:', error);
      socket.emit('read_error', { error: 'Failed to mark message as read' });
    }
  }

  handleTyping(socket, data, isTyping) {
    const { recipientIds } = data;

    if (!recipientIds || !Array.isArray(recipientIds)) {
      return;
    }

    const typingData = {
      userId: socket.userId,
      username: socket.user.username,
      isTyping
    };

    // Send typing indicator to recipients
    recipientIds.forEach(recipientId => {
      const recipientSocketId = this.connectedUsers.get(recipientId);
      if (recipientSocketId) {
        this.io.to(`user_${recipientId}`).emit('typing_indicator', typingData);
      }
    });
  }

  handleVoiceRecording(socket, data, isRecording) {
    const { recipientIds } = data;

    if (!recipientIds || !Array.isArray(recipientIds)) {
      return;
    }

    const recordingData = {
      userId: socket.userId,
      username: socket.user.username,
      isRecording
    };

    // Send voice recording indicator to recipients
    recipientIds.forEach(recipientId => {
      const recipientSocketId = this.connectedUsers.get(recipientId);
      if (recipientSocketId) {
        this.io.to(`user_${recipientId}`).emit('voice_recording_indicator', recordingData);
      }
    });
  }

  handlePresenceUpdate(socket, data) {
    const { status, customMessage } = data;
    
    const presenceData = {
      userId: socket.userId,
      username: socket.user.username,
      status, // online, away, busy, offline
      customMessage,
      lastSeen: new Date().toISOString()
    };

    // Broadcast presence update to all connected users
    socket.broadcast.emit('presence_update', presenceData);
  }

  async sendUrgentNotification(recipientIds, messageData) {
    // Send urgent notifications to recipients
    recipientIds.forEach(recipientId => {
      // Send to user's notification room
      this.io.to(`notifications_${recipientId}`).emit('urgent_notification', {
        type: 'urgent_message',
        from: messageData.senderName,
        preview: messageData.content.substring(0, 100),
        timestamp: messageData.timestamp,
        confidentialityLevel: messageData.confidentialityLevel
      });
    });

    // In production, you would also send push notifications to mobile devices
    // using services like Firebase Cloud Messaging, Apple Push Notification Service, etc.
  }

  // Method to send system-wide announcements
  sendSystemAnnouncement(message, targetRole = null) {
    const announcementData = {
      type: 'system_announcement',
      message,
      timestamp: new Date().toISOString()
    };

    if (targetRole) {
      this.io.to(`role_${targetRole}`).emit('system_announcement', announcementData);
    } else {
      this.io.emit('system_announcement', announcementData);
    }
  }

  // Method to get online users
  getOnlineUsers() {
    const onlineUsers = [];
    this.connectedUsers.forEach((socketId, userId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket && socket.user) {
        onlineUsers.push({
          userId: socket.userId,
          username: socket.user.username,
          role: socket.user.role,
          connectedAt: socket.handshake.time
        });
      }
    });
    return onlineUsers;
  }

  // Method to send message to specific user
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(`user_${userId}`).emit(event, data);
      return true;
    }
    return false;
  }

  // Method to send message to users with specific role
  sendToRole(role, event, data) {
    this.io.to(`role_${role}`).emit(event, data);
  }

  // Method to disconnect user
  disconnectUser(userId, reason = 'Admin disconnect') {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('force_disconnect', { reason });
        socket.disconnect(true);
      }
    }
  }
}

module.exports = new SocketService();