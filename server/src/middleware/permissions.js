/**
 * server/src/middleware/permissions.js
 *
 * RBAC permission middleware — checks if the authenticated user
 * has a specific permission within the target team.
 *
 * Usage:
 *   router.post('/:teamId/members', requireAuth, requirePermission('MANAGE_MEMBERS'), addUserToTeam)
 *
 * How it works:
 *  1. Admin users bypass all permission checks (they can do everything)
 *  2. Extracts teamId from req.params, req.body, or req.query
 *  3. Extracts userId from the JWT payload (req.auth.userId)
 *  4. Calls hasPermission(userId, teamId, code) from utils/rbac.js
 *     which looks up the Membership and resolves permissions through roles
 *  5. If the user has the permission → next()
 *  6. If not → 403 Forbidden
 *
 * This is the "Bonus: Middleware for permission-based access control"
 * requirement from the assignment.
 */

import { asyncHandler } from './error.js';
import { hasPermission } from '../utils/rbac.js';

export const requirePermission = (code) =>
  asyncHandler(async (req, res, next) => {
    // Admins bypass all RBAC checks — they have full system access
    if (req.auth?.accountType === 'admin') {
      return next();
    }

    // teamId can come from URL params, request body, or query string
    const teamId = req.params.teamId || req.body.teamId || req.query.teamId;
    if (!teamId) {
      return res.status(400).json({ message: 'teamId is required for permission checks' });
    }

    // userId comes from the JWT payload set by requireAuth middleware
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Look up the user's Membership in this team and check if they have the permission
    const allowed = await hasPermission(userId, teamId, code);
    if (!allowed) {
      return res.status(403).json({ message: 'Forbidden: missing permission' });
    }

    next();
  });
