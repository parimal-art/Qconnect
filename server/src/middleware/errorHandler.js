const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  const message = err.message || 'Internal server error';
  const errors = err.errors ? Object.values(err.errors).map(e => e.message || e) : err.errors;
  if (statusCode >= 500) console.error(err);
  res.status(statusCode).json({
    success: false,
    message,
    errors: errors || [],
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = { notFound, errorHandler };
