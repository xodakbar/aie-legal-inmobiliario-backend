// src/controllers/type.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const getPropertyTypes = async (req: Request, res: Response) => {
  try {
    const list = await prisma.propertyType.findMany({ orderBy: { name: 'asc' } });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
