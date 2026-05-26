import { asyncHandler } from './error.js';
import { hasPermission } from '../utils/rbac.js';

// Usage: requirePermission('CREATE_TASK')
export const requirePermission = (code) =>
  asyncHandler(async (req, res, next) => {
    // Admins bypass permission checks
    if (req.auth?.accountType === 'admin') {
      return next();
    }

    const teamId = req.params.teamId || req.body.teamId || req.query.teamId;
    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required for permission checks' });
    }

    // req.auth.userId is set by the JWT middleware (see utils/auth.js signAuthToken)
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const allowed = await hasPermission(userId, teamId, code);
    if (!allowed) {
      return res.status(403).json({ message: 'Forbidden: missing permission' });
    }

    next();
  });
