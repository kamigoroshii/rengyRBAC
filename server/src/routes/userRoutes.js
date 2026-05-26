import { Router } from 'express';
import { createUser, getUsers } from '../controllers/userController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.route('/').get(getUsers).post(requireAdmin, createUser);

export default router;
