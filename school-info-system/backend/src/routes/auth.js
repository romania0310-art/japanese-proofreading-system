const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logSecurityEvent } = require('../middleware/auditLogger');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /auth/register
 * Register a new user (Admin only)
 */
router.post('/register', asyncHandler(async (req, res) => {
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
      isActive: true,
      createdAt: true
    }
  });

  // Log security event
  await logSecurityEvent(null, 'USER_REGISTRATION', {
    newUserId: user.id,
    username: user.username,
    role: user.role,
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
 * POST /auth/login
 * User login
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new AppError('Username and password are required', 400, 'MISSING_CREDENTIALS');
  }

  // Find user by username or email
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        { email: username }
      ]
    }
  });

  if (!user) {
    await logSecurityEvent(null, 'LOGIN_FAILED', {
      reason: 'USER_NOT_FOUND',
      attemptedUsername: username,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    await logSecurityEvent(user.id, 'LOGIN_FAILED', {
      reason: 'ACCOUNT_DEACTIVATED',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    await logSecurityEvent(user.id, 'LOGIN_FAILED', {
      reason: 'INVALID_PASSWORD',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  // Generate JWT tokens
  const tokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role
  };

  const accessToken = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() }
  });

  // Store session (optional - for session management)
  const tokenHash = require('crypto').createHash('sha256').update(refreshToken).digest('hex');
  
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });

  // Log successful login
  await logSecurityEvent(user.id, 'LOGIN_SUCCESS', {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      department: user.department,
      fullName: user.fullName,
      lastLogin: user.lastLogin
    },
    tokens: {
      accessToken,
      refreshToken
    }
  });
}));

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    // Check if session exists and is valid
    const tokenHash = require('crypto').createHash('sha256').update(refreshToken).digest('hex');
    
    const session = await prisma.session.findFirst({
      where: {
        userId: decoded.userId,
        tokenHash,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            isActive: true
          }
        }
      }
    });

    if (!session) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (!session.user.isActive) {
      throw new AppError('Account is deactivated', 403, 'ACCOUNT_DEACTIVATED');
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        userId: session.user.id,
        username: session.user.username,
        role: session.user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Update session last accessed time
    await prisma.session.update({
      where: { id: session.id },
      data: { lastAccessed: new Date() }
    });

    res.json({
      success: true,
      accessToken: newAccessToken
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Refresh token has expired', 401, 'REFRESH_TOKEN_EXPIRED');
    } else if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
    throw error;
  }
}));

/**
 * POST /auth/logout
 * User logout
 */
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    const tokenHash = require('crypto').createHash('sha256').update(refreshToken).digest('hex');
    
    // Remove the session
    await prisma.session.deleteMany({
      where: {
        userId: req.user.id,
        tokenHash
      }
    });
  }

  // Log logout
  await logSecurityEvent(req.user.id, 'LOGOUT', {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
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
      lastLogin: true
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
 * PUT /auth/profile
 * Update user profile
 */
router.put('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const { fullName, phone, department } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(fullName !== undefined && { fullName }),
      ...(phone !== undefined && { phone }),
      ...(department !== undefined && { department })
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      department: true,
      fullName: true,
      phone: true,
      updatedAt: true
    }
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: updatedUser
  });
}));

/**
 * POST /auth/change-password
 * Change user password
 */
router.post('/change-password', authMiddleware, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400, 'MISSING_PASSWORDS');
  }

  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters long', 400, 'WEAK_PASSWORD');
  }

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, passwordHash: true }
  });

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isValidPassword) {
    await logSecurityEvent(req.user.id, 'PASSWORD_CHANGE_FAILED', {
      reason: 'INVALID_CURRENT_PASSWORD',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD');
  }

  // Hash new password
  const saltRounds = parseInt(process.env.SALT_ROUNDS) || 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash: newPasswordHash }
  });

  // Invalidate all existing sessions for security
  await prisma.session.deleteMany({
    where: { userId: req.user.id }
  });

  // Log password change
  await logSecurityEvent(req.user.id, 'PASSWORD_CHANGED', {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json({
    success: true,
    message: 'Password changed successfully. Please login again.'
  });
}));

module.exports = router;