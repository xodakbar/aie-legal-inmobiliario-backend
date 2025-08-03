import { Router } from "express";
import { PrismaClient } from "@prisma/client";
const router = Router();
const prisma = new PrismaClient();

router.get('/search', async (req, res) => {
  const { query = "", page = 1, pageSize = 20 } = req.query;
  const where: any = { nombre: { contains: String(query), mode: "insensitive" } };
  const skip = (Number(page) - 1) * Number(pageSize);
  const regiones = await prisma.region.findMany({ where, skip, take: Number(pageSize), orderBy: { nombre: "asc" } });
  const total = await prisma.region.count({ where });
  res.json({ data: regiones, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) });
});

export default router;
