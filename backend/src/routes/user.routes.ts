import { Router } from 'express';
import { getUsers, getUserById, updateUser, deleteUser } from '../controllers/user.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth';

const router = Router();

// Solo admin puede ver todos los usuarios
router.get('/', authenticateToken, authorizeRoles('admin'), getUsers);

// Un usuario autenticado puede ver su propio perfil
router.get('/:id', authenticateToken, (req, res, next) => {
  const user = (req as any).user;
  if (user.rol === 'admin' || Number(req.params.id) === user.userId) {
    next();
  } else {
    res.status(403).json({ error: 'No autorizado' });
  }
}, getUserById);

// Solo admin puede eliminar usuarios
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteUser);

// Solo el usuario o admin puede editar
router.put('/:id', authenticateToken, (req, res, next) => {
  const user = (req as any).user;
  if (user.rol === 'admin' || Number(req.params.id) === user.userId) {
    next();
  } else {
    res.status(403).json({ error: 'No autorizado' });
  }
}, updateUser);

export default router;
