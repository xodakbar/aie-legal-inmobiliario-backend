// src/routes/propiedades.routes.ts
import { Router } from "express";
import {
  getPropiedades,
  getPropiedadById,
  createPropiedad,
  updatePropiedad,
  deletePropiedad,
} from "../controllers/propiedad.controller";
import upload from "../middlewares/upload.middleware";
import { authenticateToken, authorizeRoles } from "../middlewares/auth";

const router = Router();

// Públicas
router.get("/", getPropiedades);
router.get("/:id", getPropiedadById);

// Protegidas (solo admin)
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  upload.array("imagenes", 36),
  createPropiedad
);

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  upload.array("imagenes", 36),
  updatePropiedad
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  deletePropiedad
);

export default router;
