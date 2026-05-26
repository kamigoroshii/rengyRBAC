/**
 * server/src/middleware/error.js
 *
 * Centralised error handling utilities.
 *
 * Exports:
 *
 *  AppError
 *    Custom error class that carries an HTTP status code.
 *    Throw this anywhere in a controller to return a clean JSON error.
 *    Example: throw new AppError('Email must be unique', 409)
 *
 *  asyncHandler(fn)
 *    Wraps an async route handler so any thrown error or rejected promise
 *    is automatically passed to Express's next(err) — no try/catch needed
 *    in every controller.
 *    Example: export const getUsers = asyncHandler(async (req, res) => { ... })
 *
 *  notFound
 *    Catches any request that didn't match a route and returns 404.
 *    Mounted last before errorHandler in app.js.
 *
 *  errorHandler
 *    Express error-handling middleware (4 params: err, req, res, next).
 *    Formats all errors into a consistent JSON response.
 *    Hides the stack trace in production to avoid leaking internals.
 */

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

/**
 * Wraps async route handlers to catch errors automatically.
 * Without this, unhandled promise rejections would crash the server.
 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

/**
 * 404 handler — mounted after all routes in app.js.
 * Any request that reaches here didn't match any route.
 */
export const notFound = (req, res, next) => {
  console.warn(`[api] 404 ${req.method} ${req.originalUrl}`);
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

/**
 * Global error formatter — must have exactly 4 parameters for Express
 * to recognise it as an error-handling middleware.
 * Converts any error (AppError or unexpected) into a JSON response.
 */
export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const message    = error.message    || 'Server error';

  console.error(`[api] error ${statusCode} ${req?.method} ${req?.originalUrl}: ${message}`);

  res.status(statusCode).json({
    message,
    // Only include stack trace in development — never expose in production
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
  });
};
