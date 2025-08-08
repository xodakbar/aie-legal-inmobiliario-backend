import { Router } from 'express';
import { register, login, forgotPassword, resetPassword } from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

export default router;
