// src/routes/auth.routes.ts
import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/auth.controller";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

// Registro y login
router.post("/register", register);
router.post("/login", login);

// Tokens
router.post("/refresh", refresh);
router.post("/logout", logout);

// Info del usuario autenticado
router.get("/me", authenticateToken, me);

// Flujos de contraseña
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", authenticateToken, changePassword);

export default router;
