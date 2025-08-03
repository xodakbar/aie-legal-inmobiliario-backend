import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = Router();


// /api/comunas/search?query=puente&regionId=1&ciudadId=...
router.get('/search', async (req, res) => {
  const { query = "", regionId, ciudadId, page = 1, pageSize = 20 } = req.query;
  const where: any = {
    nombre: { contains: String(query), mode: "insensitive" },
  };

  if (ciudadId) where.ciudadId = Number(ciudadId);

  if (regionId) {
    // Busca sólo comunas de ciudades de esa región
    const prisma = new PrismaClient();
    const ciudades = await prisma.ciudad.findMany({
      where: { regionId: Number(regionId) },
      select: { id: true }
    });
    where.ciudadId = { in: ciudades.map(c => c.id) };
  }

  const skip = (Number(page) - 1) * Number(pageSize);
  const comunas = await prisma.comuna.findMany({
    where,
    skip,
    take: Number(pageSize),
    orderBy: { nombre: "asc" },
    include: {
      ciudad: { include: { region: true } }
    }
  });
  // Para saber cuántas hay en total (opcional)
  const total = await prisma.comuna.count({ where });

  res.json({
    data: comunas,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / Number(pageSize))
  });
});

// GET /api/comunas/buscar?nombre=Pedro Aguirre Cerda&region=Región Metropolitana
router.get('/buscar', async (req, res) => {
  const { nombre, region } = req.query;
  if (!nombre || !region) {
    return res.status(400).json({ error: "Faltan parámetros (nombre, region)" });
  }

  // 1. Busca región (case-insensitive)
  const reg = await prisma.region.findFirst({
    where: { nombre: { contains: region as string, mode: "insensitive" } }
  });
  if (!reg) return res.status(404).json({ error: "Región no encontrada" });

  // 2. Busca la comuna en esa región (a través de ciudad)
  const comuna = await prisma.comuna.findFirst({
    where: {
      nombre: { equals: nombre as string, mode: "insensitive" },
      ciudad: { regionId: reg.id }
    },
    include: {
      ciudad: { select: { id: true, nombre: true, regionId: true } }
    }
  });
  if (!comuna) return res.status(404).json({ error: "Comuna no encontrada" });

  // 3. Devuelve info relacionada
  res.json({
    id: comuna.id,
    nombre: comuna.nombre,
    ciudad: comuna.ciudad.nombre,
    ciudadId: comuna.ciudad.id,
    region: reg.nombre,
    regionId: reg.id
  });
});

export default router;
