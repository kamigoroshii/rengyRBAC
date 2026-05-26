import { Router } from 'express';
import { me, signIn, signUp } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.get('/me', requireAuth, me);

export default router;
