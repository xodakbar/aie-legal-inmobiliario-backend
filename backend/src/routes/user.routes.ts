// src/routes/user.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { getUsers, getUserById, updateUser, deleteUser } from "../controllers/user.controller";
import { authenticateToken, authorizeRoles, enforcePasswordChange } from "../middlewares/auth";

const router = Router();

/** Guard genérico: permite si es admin o si el :id coincide con req.user.id */
function allowSelfOrAdmin(req: Request, res: Response, next: NextFunction) {
  const u = req.user;
  const id = Number(req.params.id);
  if (!u) return res.status(401).json({ error: "No autenticado" });
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  if (u.rol === "admin" || u.id === id) return next();
  return res.status(403).json({ error: "No autorizado" });
}

/** (Opcional) evitar que un admin se borre a sí mismo por accidente */
function preventSelfDelete(req: Request, res: Response, next: NextFunction) {
  const u = req.user!;
  const id = Number(req.params.id);
  if (u.rol === "admin" && u.id === id) {
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta de administrador" });
  }
  next();
}

// ===================== Rutas =====================

// Solo admin puede ver todos los usuarios
router.get(
  "/",
  authenticateToken,
  enforcePasswordChange(),
  authorizeRoles("admin"),
  getUsers
);

// Un usuario autenticado puede ver su propio perfil o admin puede ver cualquiera
router.get(
  "/:id",
  authenticateToken,
  enforcePasswordChange(),
  allowSelfOrAdmin,
  getUserById
);

// Solo admin puede eliminar usuarios (opcionalmente evita auto-delete)
router.delete(
  "/:id",
  authenticateToken,
  enforcePasswordChange(),
  authorizeRoles("admin"),
  preventSelfDelete,
  deleteUser
);

// Solo el usuario dueño del perfil o admin puede editar
router.put(
  "/:id",
  authenticateToken,
  enforcePasswordChange(),
  allowSelfOrAdmin,
  updateUser
);

// (Opcional) si prefieres actualización parcial:
// router.patch("/:id", authenticateToken, enforcePasswordChange(), allowSelfOrAdmin, updateUser);

export default router;
