// middleware/errorHandler.js

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Multer's oversized-upload error has no statusCode and a terse default
  // message — surface a clean, actionable one instead of a raw 500/413.
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File too large. Maximum size is 5 MB.';
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(err.code && { code: err.code }),
    // Add more details if in development mode
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
