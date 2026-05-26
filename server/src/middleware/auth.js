/**
 * server/src/middleware/auth.js
 *
 * JWT authentication middleware.
 *
 * Exports two middleware functions:
 *
 *  requireAuth
 *    Verifies the Bearer token in the Authorization header.
 *    On success: attaches the decoded payload to req.auth and req.user.
 *    The payload contains: { userId, email, accountType }
 *    On failure: returns 401 Unauthorized.
 *
 *  requireAdmin
 *    Must be used AFTER requireAuth (needs req.auth to be set).
 *    Checks that req.auth.accountType === 'admin'.
 *    On failure: returns 403 Forbidden.
 *    Used to protect routes like creating users, teams, roles, permissions.
 *
 * Usage in routes:
 *   router.post('/users', requireAuth, requireAdmin, createUser)
 *   router.get('/users',  requireAuth, getUsers)
 */

import jwt from 'jsonwebtoken';
import { AppError } from './error.js';

export const requireAuth = (req, res, next) => {
  // Extract token from "Authorization: Bearer <token>" header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    // Verify signature and expiry — throws if invalid or expired
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    req.user = req.auth; // alias for convenience
    return next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
};

export const requireAdmin = (req, res, next) => {
  // req.auth is set by requireAuth — must run after it
  if (req.auth?.accountType !== 'admin') {
    return next(new AppError('Admin access required', 403));
  }

  return next();
};
