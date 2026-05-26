export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const notFound = (req, res, next) => {
  console.warn(`[api] 404 ${req.method} ${req.originalUrl}`);
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server error';

  console.error(`[api] error ${statusCode} ${req?.method || 'UNKNOWN'} ${req?.originalUrl || 'UNKNOWN'}: ${message}`);

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
  });
};
