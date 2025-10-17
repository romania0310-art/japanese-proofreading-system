const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { requireAdmin, requireStaff } = require('../middleware/auth');
const { logSecurityEvent } = require('../middleware/auditLogger');

const router = express.Router();
const prisma = new PrismaClient();

// 統計データ取得
router.get('/stats', requireStaff, async (req, res) => {
  try {
    const [
      totalUsers,
      totalGroups, 
      totalMessages,
      activeUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userGroup.count(),
      prisma.message.count(),
      prisma.user.count({ where: { isActive: true } })
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalGroups,
        totalMessages,
        activeUsers
      }
    });

  } catch (error) {
    console.error('統計データ取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '統計データの取得に失敗しました'
    });
  }
});

// ユーザー一覧取得
router.get('/users', requireStaff, async (req, res) => {
  try {
    const { search, role, department, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = {};
    
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
        { fullName: { contains: search } },
        { department: { contains: search } }
      ];
    }
    
    if (role) {
      where.role = role;
    }
    
    if (department) {
      where.department = department;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        phone: true,
        isActive: true,
        createdAt: true,
        lastLogin: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.user.count({ where });

    await logSecurityEvent(req.user.id, 'USERS_VIEW', {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザー一覧の取得に失敗しました'
    });
  }
});

// ユーザー作成
router.post('/users', requireAdmin, async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      fullName,
      role = 'USER',
      department,
      phone
    } = req.body;

    // 入力検証
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: '必須項目が不足しています'
      });
    }

    // 既存ユーザーチェック
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'ユーザー名またはメールアドレスが既に使用されています'
      });
    }

    // パスワードハッシュ化
    const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        fullName,
        role,
        department,
        phone,
        isActive: true
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        phone: true,
        isActive: true,
        createdAt: true
      }
    });

    await logSecurityEvent(req.user.id, 'USER_CREATE', {
      targetUserId: user.id,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'ユーザーを作成しました',
      user
    });

  } catch (error) {
    console.error('ユーザー作成エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザーの作成に失敗しました'
    });
  }
});

// ユーザー更新
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const {
      username,
      email,
      fullName,
      role,
      department,
      phone,
      isActive,
      password
    } = req.body;

    // 更新データの準備
    const updateData = {
      username,
      email,
      fullName,
      role,
      department,
      phone,
      isActive
    };

    // パスワード更新の場合
    if (password) {
      const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;
      updateData.passwordHash = await bcrypt.hash(password, saltRounds);
    }

    // 重複チェック（自分以外）
    if (username || email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: userId } },
            {
              OR: [
                { username },
                { email }
              ]
            }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'ユーザー名またはメールアドレスが既に使用されています'
        });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        phone: true,
        isActive: true,
        updatedAt: true
      }
    });

    await logSecurityEvent(req.user.id, 'USER_UPDATE', {
      targetUserId: userId,
      changes: updateData,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'ユーザー情報を更新しました',
      user
    });

  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザー情報の更新に失敗しました'
    });
  }
});

// ユーザー削除
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // 自分自身は削除不可
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '自分自身を削除することはできません'
      });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    await logSecurityEvent(req.user.id, 'USER_DELETE', {
      targetUserId: userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'ユーザーを削除しました'
    });

  } catch (error) {
    console.error('ユーザー削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ユーザーの削除に失敗しました'
    });
  }
});

// グループ一覧取得
router.get('/groups', requireStaff, async (req, res) => {
  try {
    const groups = await prisma.userGroup.findMany({
      include: {
        createdBy: {
          select: {
            fullName: true,
            username: true
          }
        },
        members: {
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
      orderBy: { createdAt: 'desc' }
    });

    await logSecurityEvent(req.user.id, 'GROUPS_VIEW', {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      groups: groups.map(group => ({
        ...group,
        memberCount: group.members.length,
        createdByName: group.createdBy.fullName || group.createdBy.username
      }))
    });

  } catch (error) {
    console.error('グループ一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'グループ一覧の取得に失敗しました'
    });
  }
});

// グループ作成
router.post('/groups', requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'グループ名は必須です'
      });
    }

    const group = await prisma.userGroup.create({
      data: {
        name,
        description,
        createdById: req.user.id
      },
      include: {
        createdBy: {
          select: {
            fullName: true,
            username: true
          }
        }
      }
    });

    await logSecurityEvent(req.user.id, 'GROUP_CREATE', {
      groupId: group.id,
      groupName: group.name,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'グループを作成しました',
      group
    });

  } catch (error) {
    console.error('グループ作成エラー:', error);
    res.status(500).json({
      success: false,
      message: 'グループの作成に失敗しました'
    });
  }
});

// グループ更新
router.put('/groups/:id', requireAdmin, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const { name, description } = req.body;

    const group = await prisma.userGroup.update({
      where: { id: groupId },
      data: { name, description },
      include: {
        createdBy: {
          select: {
            fullName: true,
            username: true
          }
        }
      }
    });

    await logSecurityEvent(req.user.id, 'GROUP_UPDATE', {
      groupId,
      changes: { name, description },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'グループ情報を更新しました',
      group
    });

  } catch (error) {
    console.error('グループ更新エラー:', error);
    res.status(500).json({
      success: false,
      message: 'グループ情報の更新に失敗しました'
    });
  }
});

// グループ削除
router.delete('/groups/:id', requireAdmin, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);

    await prisma.userGroup.delete({
      where: { id: groupId }
    });

    await logSecurityEvent(req.user.id, 'GROUP_DELETE', {
      groupId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'グループを削除しました'
    });

  } catch (error) {
    console.error('グループ削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'グループの削除に失敗しました'
    });
  }
});

// メッセージ履歴取得
router.get('/messages', requireStaff, async (req, res) => {
  try {
    const { 
      search, 
      confidentialityLevel, 
      senderId,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (search) {
      where.contentEncrypted = { contains: search };
    }

    if (confidentialityLevel) {
      where.confidentialityLevel = parseInt(confidentialityLevel);
    }

    if (senderId) {
      where.senderId = parseInt(senderId);
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            fullName: true,
            username: true
          }
        },
        recipients: {
          include: {
            recipient: {
              select: {
                fullName: true,
                username: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.message.count({ where });

    await logSecurityEvent(req.user.id, 'MESSAGES_VIEW', {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      messages: messages.map(message => ({
        ...message,
        senderName: message.sender.fullName || message.sender.username,
        recipientCount: message.recipients.length
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('メッセージ履歴取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージ履歴の取得に失敗しました'
    });
  }
});

// メッセージ削除
router.delete('/messages/:id', requireAdmin, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);

    await prisma.message.delete({
      where: { id: messageId }
    });

    await logSecurityEvent(req.user.id, 'MESSAGE_DELETE', {
      messageId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'メッセージを削除しました'
    });

  } catch (error) {
    console.error('メッセージ削除エラー:', error);
    res.status(500).json({
      success: false,
      message: 'メッセージの削除に失敗しました'
    });
  }
});

// 監査ログ取得
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: {
            fullName: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.auditLog.count();

    res.json({
      success: true,
      logs: logs.map(log => ({
        ...log,
        userName: log.user ? (log.user.fullName || log.user.username) : 'システム'
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('監査ログ取得エラー:', error);
    res.status(500).json({
      success: false,
      message: '監査ログの取得に失敗しました'
    });
  }
});

module.exports = router;