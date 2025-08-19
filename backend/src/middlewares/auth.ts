// src/middlewares/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Debe coincidir con lo que firmas al crear el token
type TokenPayload = {
  id: number;
  rol?: string;
  email?: string;
  iat?: number;
  exp?: number;
};

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) return res.status(401).json({ error: "No autenticado" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
    // expone un objeto limpio en req.user (declaration merging)
    req.user = { id: decoded.id, rol: decoded.rol, email: decoded.email };
    return next();
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expirado" });
    }
    return res.status(401).json({ error: "Token inválido" });
  }
}

export function authorizeRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    if (!roles.includes(req.user.rol || "")) {
      return res.status(403).json({ error: "No autorizado" });
    }
    next();
  };
}
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  next();
}