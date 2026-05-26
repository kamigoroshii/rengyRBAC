import jwt from 'jsonwebtoken';
import { AppError } from './error.js';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    req.user = req.auth;
    return next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.auth?.accountType !== 'admin') {
    return next(new AppError('Admin access required', 403));
  }

  return next();
};
