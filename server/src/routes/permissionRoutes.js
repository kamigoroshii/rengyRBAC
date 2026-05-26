import { Router } from 'express';
import { createPermission, getPermissions } from '../controllers/permissionController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.route('/').get(getPermissions).post(requireAdmin, createPermission);

export default router;
