// src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function isStrongPassword(p?: string) {
  if (!p) return false;
  return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);
}

// ============ GET /users ============
export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        mustChangePassword: true,           // nuevo campo
        passwordLastChangedAt: true,        // opcional mostrarlo
      },
      orderBy: { id: 'asc' },
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error al listar usuarios' });
  }
};

// ============ GET /users/:id ============
export const getUserById = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const user = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        mustChangePassword: true,
        passwordLastChangedAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error al obtener usuario' });
  }
};

// ============ PATCH /users/:id ============
/**
 * Permite actualizar:
 * - nombre, email
 * - rol (ej: 'admin' / 'user' / 'agente')
 * - mustChangePassword (forzar cambio en próximo login)
 * - password (rehash + passwordLastChangedAt)
 */
export const updateUser = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  const { nombre, email, password, rol, mustChangePassword } = req.body as {
    nombre?: string;
    email?: string;
    password?: string;
    rol?: string;
    mustChangePassword?: boolean;
  };

  try {
    // Construimos el payload de actualización de manera segura
    const data: any = {};

    if (typeof nombre === 'string' && nombre.trim().length > 0) data.nombre = nombre.trim();
    if (typeof email === 'string' && email.trim().length > 0) data.email = email.trim();

    if (typeof rol === 'string' && rol.trim().length > 0) {
      // TIP: aquí podrías validar contra una lista permitida ['admin','user','agente']
      data.rol = rol.trim();
    }

    if (typeof mustChangePassword === 'boolean') {
      data.mustChangePassword = mustChangePassword;
    }

    if (typeof password === 'string' && password.length > 0) {
      if (!isStrongPassword(password)) {
        return res.status(400).json({
          error: 'Contraseña insegura (mín. 8, con mayúscula, minúscula y número)',
        });
      }
      data.password = await bcrypt.hash(password, 10);
      data.passwordLastChangedAt = new Date();
      // Si por política, quieres que al cambiar password NO se fuerce cambio:
      // data.mustChangePassword = false;
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        mustChangePassword: true,
        passwordLastChangedAt: true,
      },
    });

    res.json(updated);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      // Unique constraint (email)
      return res.status(400).json({ error: 'El email ya está en uso' });
    }
    if (error?.code === 'P2025') {
      // Registro no encontrado
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.status(500).json({ error: error.message || 'Error al actualizar usuario' });
  }
};

// ============ DELETE /users/:id ============
export const deleteUser = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    await prisma.usuario.delete({ where: { id } });
    res.json({ message: 'Usuario eliminado' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.status(500).json({ error: error.message || 'Error al eliminar usuario' });
  }
};
