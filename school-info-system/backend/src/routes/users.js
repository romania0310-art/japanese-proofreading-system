const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authMiddleware, requireRole, requireAdmin, requireStaff } = require('../middleware/auth');
const { logSecurityEvent } = require('../middleware/auditLogger');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/users
 * Get all users (staff and admin only)
 */
router.get('/', requireStaff, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    role,
    department,
    isActive,
    search
  } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  // Build where clause
  const whereClause = {};

  if (role) {
    whereClause.role = role;
  }

  if (department) {
    whereClause.department = { contains: department, mode: 'insensitive' };
  }

  if (isActive !== undefined) {
    whereClause.isActive = isActive === 'true';
  }

  if (search) {
    whereClause.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        department: true,
        fullName: true,
        phone: true,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            sentMessages: true,
            receivedMessages: true
          }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { role: 'asc' },
        { fullName: 'asc' }
      ],
      skip: offset,
      take: limitNum
    }),
    prisma.user.count({ where: whereClause })
  ]);

  res.json({
    success: true,
    users,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
}));

/**
 * GET /api/users/departments
 * Get list of all departments
 */
router.get('/departments', requireStaff, asyncHandler(async (req, res) => {
  const departments = await prisma.user.findMany({
    where: {
      department: { not: null },
      isActive: true
    },
    select: { department: true },
    distinct: ['department']
  });

  const departmentList = departments
    .map(d => d.department)
    .filter(Boolean)
    .sort();

  res.json({
    success: true,
    departments: departmentList
  });
}));

/**
 * GET /api/users/recipients
 * Get potential message recipients (excluding current user)
 */
router.get('/recipients', asyncHandler(async (req, res) => {
  const { role, department } = req.query;

  const whereClause = {
    id: { not: req.user.id }, // Exclude current user
    isActive: true
  };

  if (role) {
    whereClause.role = role;
  }

  if (department) {
    whereClause.department = department;
  }

  const recipients = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      department: true
    },
    orderBy: [
      { role: 'asc' },
      { department: 'asc' },
      { fullName: 'asc' }
    ]
  });

  res.json({
    success: true,
    recipients
  });
}));

/**
 * POST /api/users
 * Create a new user (admin only)
 */
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const {
    username,
    email,
    password,
    role = 'USER',
    department,
    fullName,
    phone
  } = req.body;

  // Validation
  if (!username || !email || !password) {
    throw new AppError('Username, email, and password are required', 400, 'MISSING_FIELDS');
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400, 'WEAK_PASSWORD');
  }

  if (!['ADMIN', 'STAFF', 'USER'].includes(role)) {
    throw new AppError('Invalid role', 400, 'INVALID_ROLE');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        { email }
      ]
    }
  });

  if (existingUser) {
    throw new AppError('User with this username or email already exists', 409, 'USER_EXISTS');
  }

  // Hash password
  const saltRounds = parseInt(process.env.SALT_ROUNDS) || 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role,
      department,
      fullName,
      phone
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      department: true,
      fullName: true,
      phone: true,
      isActive: true,
      createdAt: true
    }
  });

  // Log user creation
  await logSecurityEvent(req.user.id, 'USER_CREATED', {
    newUserId: user.id,
    newUsername: user.username,
    newUserRole: user.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    user
  });
}));

/**
 * GET /api/users/:id
 * Get user by ID (staff and admin, or own profile)
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);

  // Users can access their own profile, staff/admin can access any profile
  if (userId !== req.user.id && !['ADMIN', 'STAFF'].includes(req.user.role)) {
    throw new AppError('Insufficient permissions to view this profile', 403, 'INSUFFICIENT_PERMISSIONS');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      department: true,
      fullName: true,
      phone: true,
      isActive: true,
      twoFactorEnabled: true,
      createdAt: true,
      updatedAt: true,
      lastLogin: true,
      _count: {
        select: {
          sentMessages: true,
          receivedMessages: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    user
  });
}));

/**
 * PUT /api/users/:id
 * Update user (admin for any user, users for their own profile with restrictions)
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);
  const isOwnProfile = userId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';

  // Permission check
  if (!isOwnProfile && !isAdmin) {
    throw new AppError('Insufficient permissions to update this profile', 403, 'INSUFFICIENT_PERMISSIONS');
  }

  const {
    email,
    role,
    department,
    fullName,
    phone,
    isActive,
    twoFactorEnabled
  } = req.body;

  // Verify user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!existingUser) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Build update data based on permissions
  const updateData = {};

  // Fields users can update for themselves
  if (fullName !== undefined) updateData.fullName = fullName;
  if (phone !== undefined) updateData.phone = phone;
  
  // Fields only admins can update, or users can update for themselves with restrictions
  if (email !== undefined) {
    if (!isOwnProfile && !isAdmin) {
      throw new AppError('Only admins can change other users\' email addresses', 403, 'INSUFFICIENT_PERMISSIONS');
    }
    updateData.email = email;
  }

  if (department !== undefined) {
    if (!isOwnProfile && !isAdmin) {
      throw new AppError('Only admins can change other users\' departments', 403, 'INSUFFICIENT_PERMISSIONS');
    }
    updateData.department = department;
  }

  // Admin-only fields
  if (role !== undefined) {
    if (!isAdmin) {
      throw new AppError('Only admins can change user roles', 403, 'INSUFFICIENT_PERMISSIONS');
    }
    if (!['ADMIN', 'STAFF', 'USER'].includes(role)) {
      throw new AppError('Invalid role', 400, 'INVALID_ROLE');
    }
    updateData.role = role;
  }

  if (isActive !== undefined) {
    if (!isAdmin) {
      throw new AppError('Only admins can activate/deactivate users', 403, 'INSUFFICIENT_PERMISSIONS');
    }
    updateData.isActive = isActive;
  }

  if (twoFactorEnabled !== undefined) {
    updateData.twoFactorEnabled = twoFactorEnabled;
  }

  // Check for email uniqueness if email is being updated
  if (updateData.email) {
    const emailExists = await prisma.user.findFirst({
      where: {
        email: updateData.email,
        id: { not: userId }
      }
    });

    if (emailExists) {
      throw new AppError('Email address is already in use', 409, 'EMAIL_EXISTS');
    }
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      department: true,
      fullName: true,
      phone: true,
      isActive: true,
      twoFactorEnabled: true,
      updatedAt: true
    }
  });

  // Log user update
  await logSecurityEvent(req.user.id, 'USER_UPDATED', {
    targetUserId: userId,
    changes: Object.keys(updateData),
    isOwnProfile,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    success: true,
    message: 'User updated successfully',
    user: updatedUser
  });
}));

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);

  // Prevent self-deletion
  if (userId === req.user.id) {
    throw new AppError('Cannot delete your own account', 400, 'CANNOT_DELETE_SELF');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Delete user (cascade will handle related records)
  await prisma.user.delete({
    where: { id: userId }
  });

  // Log user deletion
  await logSecurityEvent(req.user.id, 'USER_DELETED', {
    deletedUserId: userId,
    deletedUsername: user.username,
    deletedUserRole: user.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
}));

/**
 * POST /api/users/:id/reset-password
 * Reset user password (admin only)
 */
router.post('/:id/reset-password', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword) {
    throw new AppError('New password is required', 400, 'MISSING_PASSWORD');
  }

  if (newPassword.length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400, 'WEAK_PASSWORD');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Hash new password
  const saltRounds = parseInt(process.env.SALT_ROUNDS) || 12;
  const passwordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  // Invalidate all user sessions
  await prisma.session.deleteMany({
    where: { userId }
  });

  // Log password reset
  await logSecurityEvent(req.user.id, 'PASSWORD_RESET_BY_ADMIN', {
    targetUserId: userId,
    targetUsername: user.username,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    success: true,
    message: 'Password reset successfully. User will need to login with the new password.'
  });
}));

/**
 * GET /api/users/stats/overview
 * Get user statistics (admin only)
 */
router.get('/stats/overview', requireAdmin, asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    adminUsers,
    staffUsers,
    regularUsers,
    recentLogins,
    departments
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: 'ADMIN', isActive: true } }),
    prisma.user.count({ where: { role: 'STAFF', isActive: true } }),
    prisma.user.count({ where: { role: 'USER', isActive: true } }),
    prisma.user.count({
      where: {
        lastLogin: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    }),
    prisma.user.groupBy({
      by: ['department'],
      where: {
        department: { not: null },
        isActive: true
      },
      _count: { department: true }
    })
  ]);

  res.json({
    success: true,
    stats: {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole: {
        admin: adminUsers,
        staff: staffUsers,
        user: regularUsers
      },
      recentLogins,
      departmentDistribution: departments.map(d => ({
        department: d.department,
        count: d._count.department
      }))
    }
  });
}));

module.exports = router;