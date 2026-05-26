import { asyncHandler } from './error.js';
import { hasPermission } from '../utils/rbac.js';

// Usage: requirePermission('CREATE_TASK')
export const requirePermission = (code) =>
  asyncHandler(async (req, res, next) => {
    // Admins bypass permission checks (auth middleware sets req.user)
    if (req.user?.accountType === 'admin' || req.auth?.accountType === 'admin') {
      return next();
    }

    const teamId = req.params.teamId || req.body.teamId || req.query.teamId;
    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required for permission checks' });
    }

    const userId = req.user?._id || req.auth?.userId;
    const allowed = await hasPermission(userId, teamId, code);
    if (!allowed) {
      return res.status(403).json({ message: 'Forbidden: missing permission' });
    }

    next();
  });
