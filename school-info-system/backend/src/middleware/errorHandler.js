const errorHandler = (err, req, res, next) => {
  console.error('Error Details:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user ? { id: req.user.id, username: req.user.username } : null,
    timestamp: new Date().toISOString()
  });

  // Default error response
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';

  // Handle Prisma errors
  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'A record with this data already exists';
    code = 'DUPLICATE_RECORD';
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
    code = 'RECORD_NOT_FOUND';
  } else if (err.code?.startsWith('P')) {
    statusCode = 400;
    message = 'Database operation failed';
    code = 'DATABASE_ERROR';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    code = 'TOKEN_EXPIRED';
  }

  // Handle Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    code = 'VALIDATION_ERROR';
  }

  // Handle Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File size too large';
    code = 'FILE_TOO_LARGE';
  } else if (err.code === 'LIMIT_FILE_COUNT') {
    statusCode = 400;
    message = 'Too many files uploaded';
    code = 'TOO_MANY_FILES';
  }

  // Handle syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON format';
    code = 'INVALID_JSON';
  }

  // Security-related errors
  if (err.message.includes('CSRF')) {
    statusCode = 403;
    code = 'CSRF_ERROR';
  }

  // Rate limiting errors
  if (err.message.includes('Too many requests')) {
    statusCode = 429;
    code = 'RATE_LIMIT_EXCEEDED';
  }

  const errorResponse = {
    error: {
      message,
      code,
      ...(process.env.NODE_ENV === 'development' && {
        details: err.message,
        stack: err.stack
      })
    },
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  };

  // Log error to audit log if user is authenticated
  if (req.user) {
    // Here you could log to audit trail
    console.error(`User ${req.user.id} (${req.user.username}) encountered error:`, {
      error: message,
      code,
      path: req.url,
      method: req.method
    });
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper to catch async errors in route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error creator
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError
};