import { Router } from 'express';
import {
  addUserToTeam,
  createTeam,
  getTeamMembers,
  getTeams,
  getUserPermissionsInTeam,
  removeUserFromTeam,
  updateUserRolesInTeam,
} from '../controllers/teamController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(requireAuth);
router.route('/').get(getTeams).post(requireAdmin, createTeam);
// membership operations: allow admins or users with MANAGE_MEMBERS permission in the team
router.route('/:teamId/members').get(getTeamMembers).post(requirePermission('MANAGE_MEMBERS'), addUserToTeam);
router.route('/:teamId/members/:userId').delete(requirePermission('MANAGE_MEMBERS'), removeUserFromTeam);
router.route('/:teamId/members/:userId/roles').put(requirePermission('MANAGE_MEMBERS'), updateUserRolesInTeam);
router.route('/:teamId/users/:userId/permissions').get(getUserPermissionsInTeam);

export default router;
