import { Router } from "express";
import { PrismaClient } from "@prisma/client";
const router = Router();
const prisma = new PrismaClient();

router.get('/search', async (req, res) => {
  const { query = "", regionId, page = 1, pageSize = 20 } = req.query;
  const where: any = { nombre: { contains: String(query), mode: "insensitive" } };
  if (regionId) where.regionId = Number(regionId);
  const skip = (Number(page) - 1) * Number(pageSize);
  const ciudades = await prisma.ciudad.findMany({ where, skip, take: Number(pageSize), orderBy: { nombre: "asc" }, include: { region: true } });
  const total = await prisma.ciudad.count({ where });
  res.json({ data: ciudades, total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) });
});
export default router;
