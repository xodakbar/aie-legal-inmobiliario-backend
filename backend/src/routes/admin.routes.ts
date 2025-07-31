import { Router } from 'express';
import { createUserWithRole } from '../controllers/admin.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth';

const router = Router();

// Solo admin puede crear usuarios con rol
router.post('/create-user', authenticateToken, authorizeRoles('admin'), createUserWithRole);

export default router;
