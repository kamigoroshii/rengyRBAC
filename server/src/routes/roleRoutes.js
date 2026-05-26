import { Router } from 'express';
import { createRole, getRoles, setRolePermissions } from '../controllers/roleController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.route('/').get(getRoles).post(requireAdmin, createRole);
router.route('/:roleId/permissions').put(requireAdmin, setRolePermissions);

export default router;
