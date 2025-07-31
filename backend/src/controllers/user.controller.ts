import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Obtener todos los usuarios (sin password)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.usuario.findMany({
      select: { id: true, nombre: true, email: true }
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener un usuario por ID
export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const user = await prisma.usuario.findUnique({
      where: { id: Number(id) },
      select: { id: true, nombre: true, email: true }
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar usuario
export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, email, password } = req.body;
  try {
    const data: any = {};
    if (nombre) data.nombre = nombre;
    if (email) data.email = email;
    if (password) data.password = await bcrypt.hash(password, 10);
    const user = await prisma.usuario.update({
      where: { id: Number(id) },
      data,
      select: { id: true, nombre: true, email: true }
    });
    res.json(user);
  } catch (error: any) {
    if (error.code === 'P2002') {
      // Prisma error for unique constraint
      return res.status(400).json({ error: 'El email ya está en uso' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Eliminar usuario
export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.usuario.delete({ where: { id: Number(id) } });
    res.json({ message: 'Usuario eliminado' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
