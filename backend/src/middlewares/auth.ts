// src/middlewares/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type TokenPayload = {
  id: number;
  rol?: string;
  email?: string;
  iat?: number;
  exp?: number;
};

const ACCESS_SECRET = process.env.JWT_SECRET || "supersecret";

// Middleware principal: exige token válido
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: "NO_TOKEN" }); // 👈 más fácil de manejar en front
  }

  try {
    // tolera desfases de reloj de hasta 10s
    const decoded = jwt.verify(token, ACCESS_SECRET, { clockTolerance: 10 }) as TokenPayload;
    req.user = { id: decoded.id, rol: decoded.rol, email: decoded.email };
    return next();
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "ACCESS_EXPIRED" }); // 👈 tu front lo usa para refrescar
    }
    return res.status(401).json({ error: "ACCESS_INVALID" });
  }
}

// Autorización por rol
export function authorizeRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "NO_TOKEN" });
    if (!roles.includes(req.user.rol || "")) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    next();
  };
}

// Sólo comprueba que esté autenticado (útil en rutas que no requieren rol)
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "NO_TOKEN" });
  next();
}
