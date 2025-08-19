import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { type Secret } from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { sendResetEmail } from "../utils/mailer";
import * as crypto from "crypto";

const prisma = new PrismaClient();

// secretos tipados
const ACCESS_SECRET: Secret = process.env.JWT_SECRET || "supersecret";
const REFRESH_SECRET: Secret = process.env.JWT_REFRESH_SECRET || ACCESS_SECRET;

// TTLs en segundos (números)
const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC ?? 900);       // 15 min
const REFRESH_TTL_SEC = Number(process.env.JWT_REFRESH_TTL_SEC ?? 604800);  // 7 días

type JWTPayload = { id: number; rol: string; email: string };

const signAccessToken = (p: JWTPayload) =>
  jwt.sign(p, ACCESS_SECRET, { expiresIn: ACCESS_TTL_SEC });

const signRefreshToken = (p: JWTPayload) =>
  jwt.sign(p, REFRESH_SECRET, { expiresIn: REFRESH_TTL_SEC });



const setRefreshCookie = (res: Response, token: string) => {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    sameSite: "lax", // usa 'none' + secure:true si es cross-site en https
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/refresh",
    maxAge: 7 * 24 * 60 * 60 * 1000, // alínealo con REFRESH_TTL
  });
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie("refresh_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/refresh",
  });
};

// =====================
//       Register
// =====================
export const register = async (req: Request, res: Response) => {
  const { nombre, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.usuario.create({
      data: { nombre, email, password: hashedPassword, rol: "user" },
    });
    res.status(201).json({
      message: "Usuario creado",
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "El email ya está en uso" });
    }
    res.status(400).json({ error: error.message });
  }
};

// =====================
//        Login
// =====================
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.usuario.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: "Credenciales inválidas" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Credenciales inválidas" });

    const payload: JWTPayload = { id: user.id, rol: user.rol, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // cookie HttpOnly con refresh
    setRefreshCookie(res, refreshToken);

    // devolvemos accessToken + datos públicos
    res.json({
      accessToken,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// =====================
//   Refresh Access
// =====================
export const refresh = async (req: Request, res: Response) => {
  const rt = (req as any).cookies?.refresh_token;
  if (!rt) return res.status(401).json({ error: "No refresh token" });

  try {
    const decoded = jwt.verify(rt, REFRESH_SECRET) as JWTPayload & { iat: number; exp: number };
    // opcional: validar que el usuario sigue existiendo
    const user = await prisma.usuario.findUnique({ where: { id: decoded.id } });
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Usuario inexistente" });
    }

    const payload: JWTPayload = { id: user.id, rol: user.rol, email: user.email };
    const newAccess = signAccessToken(payload);
    const newRefresh = signRefreshToken(payload); // rotación simple
    setRefreshCookie(res, newRefresh);

    return res.json({ accessToken: newAccess });
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Refresh inválido" });
  }
};

// =====================
//        Logout
// =====================
export const logout = (req: Request, res: Response) => {
  clearRefreshCookie(res);
  res.status(204).send();
};

// =====================
//         Me
// =====================
export const me = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  const user = await prisma.usuario.findUnique({
    where: { id: req.user.id },
    select: { id: true, nombre: true, email: true, rol: true },
  });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ user });
};

// =====================
//   Forgot / Reset
// =====================
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const user = await prisma.usuario.findUnique({ where: { email } });

    // Responder 200 siempre
    if (!user) {
      console.log("[forgotPassword] Email no registrado:", email);
      return res.status(200).json({ message: "Si el correo existe, recibirás un email." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    console.log("[forgotPassword] resetLink generado:", resetLink);

    try {
      const info = await sendResetEmail(email, resetLink);
      console.log("[forgotPassword] sendResetEmail OK:", info);
    } catch (mailErr: any) {
      console.error("[forgotPassword] Error al enviar correo:", mailErr?.message || mailErr);
    }

    res.json({ message: "Email de recuperación enviado." });
  } catch (err: any) {
    console.error("[forgotPassword] ERROR:", err?.message || err);
    res.status(500).json({ error: "No se pudo procesar la solicitud" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ error: "Token inválido o expirado." });
    }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.usuario.update({
    where: { id: record.userId },
    data: { password: hashed },
  });

  await prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } });

  res.json({ message: "Contraseña actualizada exitosamente." });
};
