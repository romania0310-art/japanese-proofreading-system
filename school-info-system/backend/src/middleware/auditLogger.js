const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const auditLogger = async (req, res, next) => {
  // Skip audit logging for certain routes
  const skipRoutes = [
    '/health',
    '/favicon.ico',
    '/robots.txt'
  ];

  const skipPaths = [
    '/static/',
    '/public/',
    '/assets/'
  ];

  if (skipRoutes.includes(req.path) || 
      skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Store original res.json to intercept response
  const originalJson = res.json;
  let responseData = null;
  let responseStatus = null;

  res.json = function(data) {
    responseData = data;
    responseStatus = res.statusCode;
    return originalJson.call(this, data);
  };

  // Store request start time
  req.auditStartTime = Date.now();

  // Continue with request processing
  next();

  // Log after response is sent
  res.on('finish', async () => {
    try {
      const duration = Date.now() - req.auditStartTime;
      
      // Determine action based on method and path
      let action = `${req.method} ${req.path}`;
      let resource = req.path.split('/')[1] || 'unknown';

      // More specific action naming
      if (req.path.startsWith('/auth/login')) {
        action = 'LOGIN_ATTEMPT';
        resource = 'authentication';
      } else if (req.path.startsWith('/auth/logout')) {
        action = 'LOGOUT';
        resource = 'authentication';
      } else if (req.path.startsWith('/api/messages')) {
        if (req.method === 'POST') action = 'MESSAGE_CREATE';
        else if (req.method === 'GET') action = 'MESSAGE_READ';
        else if (req.method === 'PUT') action = 'MESSAGE_UPDATE';
        else if (req.method === 'DELETE') action = 'MESSAGE_DELETE';
        resource = 'messages';
      } else if (req.path.startsWith('/api/users')) {
        if (req.method === 'POST') action = 'USER_CREATE';
        else if (req.method === 'GET') action = 'USER_READ';
        else if (req.method === 'PUT') action = 'USER_UPDATE';
        else if (req.method === 'DELETE') action = 'USER_DELETE';
        resource = 'users';
      }

      // Get client information
      const ipAddress = req.ip || 
                       req.connection.remoteAddress || 
                       req.socket.remoteAddress ||
                       (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                       req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                       'unknown';

      const userAgent = req.get('User-Agent') || 'unknown';

      // Prepare audit log data
      const auditData = {
        userId: req.user ? req.user.id : null,
        action,
        resource,
        ipAddress,
        userAgent,
        details: {
          method: req.method,
          path: req.path,
          statusCode: responseStatus,
          duration: duration,
          queryParams: Object.keys(req.query).length > 0 ? req.query : null,
          bodySize: req.body ? JSON.stringify(req.body).length : 0,
          success: responseStatus >= 200 && responseStatus < 400,
          ...(responseStatus >= 400 && responseData && {
            errorCode: responseData.error?.code,
            errorMessage: responseData.error?.message
          })
        }
      };

      // Only log significant events or errors
      const shouldLog = 
        // Always log authentication events
        resource === 'authentication' ||
        // Log all errors
        responseStatus >= 400 ||
        // Log data modification operations
        ['POST', 'PUT', 'DELETE'].includes(req.method) ||
        // Log admin actions
        (req.user && req.user.role === 'ADMIN');

      if (shouldLog) {
        try {
          await prisma.auditLog.create({
            data: auditData
          });
        } catch (dbError) {
          // Fallback to console logging if database is unavailable
          console.error('Failed to save audit log to database:', dbError);
          console.log('Audit Log (Console fallback):', {
            timestamp: new Date().toISOString(),
            ...auditData
          });
        }
      }

    } catch (error) {
      // Don't let audit logging errors break the application
      console.error('Audit logging error:', error);
    }
  });
};

// Function to manually log important security events
const logSecurityEvent = async (userId, action, details = {}) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource: 'security',
        ipAddress: details.ipAddress || 'system',
        userAgent: details.userAgent || 'system',
        details: {
          ...details,
          securityEvent: true,
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

// Function to get audit logs (for admin interface)
const getAuditLogs = async (options = {}) => {
  const {
    userId,
    action,
    resource,
    startDate,
    endDate,
    page = 1,
    limit = 50
  } = options;

  const where = {};
  
  if (userId) where.userId = userId;
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (resource) where.resource = resource;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.auditLog.count({ where })
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  auditLogger,
  logSecurityEvent,
  getAuditLogs
};