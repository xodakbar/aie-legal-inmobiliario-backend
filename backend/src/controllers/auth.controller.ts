import { Request, Response } from 'express';
import bcrypt from 'bcryptjs'; // puedes usar bcryptjs o bcrypt
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { sendResetEmail } from '../utils/mailer';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response) => {
  const { nombre, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.usuario.create({
      data: { nombre, email, password: hashedPassword, rol: "user" }
    });
    res.status(201).json({
      message: 'Usuario creado',
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El email ya está en uso' });
    }
    res.status(400).json({ error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.usuario.findUnique({ where: { email } });
    // Nunca revelar si el usuario existe o no
    if (!user) return res.status(400).json({ error: 'Credenciales inválidas' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      process.env.JWT_SECRET || 'supersecret', // ¡Usa un secreto fuerte en prod!
      { expiresIn: '1d' }
    );
    res.json({
      token,
      user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }

  
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.usuario.findUnique({ where: { email } });
  if (!user) {
    return res.status(200).json({ message: 'Si el correo existe, recibirás un email.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt }
  });

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendResetEmail(email, resetLink);

  res.json({ message: 'Email de recuperación enviado.' });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Token inválido o expirado.' });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.usuario.update({
    where: { id: record.userId },
    data: { password: hashed }
  });

  await prisma.passwordResetToken.deleteMany({
    where: { userId: record.userId }
  });

  res.json({ message: 'Contraseña actualizada exitosamente.' });
};

