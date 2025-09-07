// src/middlewares/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type TokenPayload = {
  id: number;
  rol?: string;
  email?: string;
  mustChangePassword?: boolean; // 👈 agregado
  iat?: number;
  exp?: number;
};

const ACCESS_SECRET = process.env.JWT_SECRET || "supersecret";
const COOKIE_NAME = process.env.COOKIE_NAME || "access_token"; // opcional

function extractToken(req: Request): string | undefined {
  const header = String(req.headers.authorization || "");
  if (header.startsWith("Bearer ")) return header.slice(7);

  // Opcional: si usas cookie HttpOnly
  const cookieToken = (req as any).cookies?.[COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) return cookieToken;

  return undefined;
}

// Middleware principal: exige token válido
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: "NO_TOKEN" }); // 👈 más fácil de manejar en front
  }

  try {
    // tolera desfases de reloj de hasta 10s
    const decoded = jwt.verify(token, ACCESS_SECRET, { clockTolerance: 10 }) as TokenPayload;

    req.user = {
      id: decoded.id,
      rol: decoded.rol,
      email: decoded.email,
      mustChangePassword: decoded.mustChangePassword, // 👈 importante
    };

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

// Fuerza cambio de contraseña (whitelist configurable)
export function enforcePasswordChange(
  allowed: string[] = ["/auth/change-password", "/auth/logout"]
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "NO_TOKEN" });

    // Permite rutas explícitas, subrutas y preflight
    const isAllowed =
      req.method === "OPTIONS" ||
      allowed.some((p) => req.path === p || req.path.startsWith(p + "/"));
    if (isAllowed) return next();

    if (req.user.mustChangePassword) {
      return res.status(403).json({
        error: "PASSWORD_CHANGE_REQUIRED",
        requiresPasswordChange: true,
      });
    }
    next();
  };
}
