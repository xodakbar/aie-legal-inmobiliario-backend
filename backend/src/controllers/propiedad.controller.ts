// src/controllers/property.controller.ts

import { Request, Response } from 'express';
import {
  PrismaClient,
  Prisma
} from '@prisma/client';
import cloudinary from '../utils/Cloudinary';
import { clpToUf, fetchUf } from '../services/uf.service';

const prisma = new PrismaClient();

// Helper para subir múltiples imágenes a Cloudinary
const uploadMultipleToCloudinary = (files: Express.Multer.File[]) =>
  Promise.all(
    files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'propiedades' },
            (error, result) => {
              if (result) resolve(result.secure_url);
              else reject(error);
            }
          );
          stream.end(file.buffer);
        })
    )
  );


// --- SELECT mínimo para LISTADOS (cards de Inicio + tabla Admin) ---
const listadoSelect = {
  id: true,
  titulo: true,
  precio: true,
  imagen: true,           // principal para card
  bedrooms: true,         // útiles en la card
  bathrooms: true,
  area: true,
  createdAt: true,
  status: { select: { name: true } },
  type:   { select: { name: true } },
  comuna: {
    select: {
      nombre: true,
      ciudad: { select: { nombre: true, region: { select: { nombre: true } } } },
    },
  },
} as const;

type PropiedadListado = Prisma.PropiedadGetPayload<{ select: typeof listadoSelect }>;

type PropiedadDTO = {
  id: number;
  titulo: string;
  precio: number;
  imagen: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  createdAt: Date;
  status: string;
  type: string;
  region: string;
  ciudad: string;
  comuna: string;
};

const toDTO = (p: PropiedadListado): PropiedadDTO => ({
  id: p.id,
  titulo: p.titulo,
  precio: p.precio,
  imagen: p.imagen,
  bedrooms: p.bedrooms ?? null,
  bathrooms: p.bathrooms ?? null,
  area: p.area ?? null,
  createdAt: p.createdAt,
  status: p.status?.name ?? "",
  type: p.type?.name ?? "",
  region: p.comuna?.ciudad?.region?.nombre ?? "",
  ciudad: p.comuna?.ciudad?.nombre ?? "",
  comuna: p.comuna?.nombre ?? "",
});

// Lista blanca de orden (evita inyección)
const ORDER_WHITELIST = new Set<"id" | "createdAt" | "precio" | "titulo">([
  "id", "createdAt", "precio", "titulo",
]);


export const getPropiedades = async (req: Request, res: Response) => {
  try {
    const {
      statusId, typeId, activo, minPrecio, maxPrecio,
      bedrooms, bathrooms, regionId, ciudadId, comunaId,
      page = "1", pageSize = "10", orderBy = "createdAt:desc",
    } = req.query;

    // Orden seguro
    let [campoRaw, sentidoRaw] = orderBy.toString().split(":");
    const campo = ORDER_WHITELIST.has(campoRaw as any)
      ? (campoRaw as "id" | "createdAt" | "precio" | "titulo")
      : "createdAt";
    const sentido = (sentidoRaw === "asc" || sentidoRaw === "desc" ? sentidoRaw : "desc") as Prisma.SortOrder;

    // Filtros → TODO en DB (no en memoria)
    const and: Prisma.PropiedadWhereInput[] = [];
    if (statusId)  and.push({ statusId: Number(statusId) });
    if (typeId)    and.push({ typeId: Number(typeId) });
    if (activo !== undefined) and.push({ activo: String(activo) === "true" });
    if (bedrooms)  and.push({ bedrooms: Number(bedrooms) });
    if (bathrooms) and.push({ bathrooms: Number(bathrooms) });
    if (comunaId)  and.push({ comunaId: Number(comunaId) });
    if (ciudadId)  and.push({ comuna: { ciudadId: Number(ciudadId) } });
    if (regionId)  and.push({ comuna: { ciudad: { regionId: Number(regionId) } } });

    if (minPrecio || maxPrecio) {
      const precio: Prisma.FloatFilter = {};
      if (minPrecio) precio.gte = Number(minPrecio);
      if (maxPrecio) precio.lte = Number(maxPrecio);
      and.push({ precio });
    }
    const where: Prisma.PropiedadWhereInput = and.length ? { AND: and } : {};

    // Paginación
    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    // Query optimizada (select mínimo + filtros relacionales)
    const [total, rows] = await Promise.all([
      prisma.propiedad.count({ where }),
      prisma.propiedad.findMany({
        where,
        skip,
        take,
        orderBy: { [campo]: sentido },
        select: listadoSelect,
      }),
    ]);

    res.json({
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
      data: rows.map(toDTO),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};



export const getPropiedadById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const p = await prisma.propiedad.findUnique({
      where: { id: Number(id) },
      include: {
        status: true,
        type: true,
        comuna: { include: { ciudad: { include: { region: true } } } },
      },
    });
    if (!p) return res.status(404).json({ error: "Propiedad no encontrada" });

    // Trae UF del día y calcula UF sugerida desde CLP
    const { uf, dateISO, source } = await fetchUf();
    const ufCalc = p.precio ? clpToUf(p.precio, uf) : null;

    res.json({
      ...p,
      statusName: p.status?.name ?? "",
      typeName: p.type?.name ?? "",
      regionName: p.comuna?.ciudad?.region?.nombre ?? "",
      ciudadName: p.comuna?.ciudad?.nombre ?? "",
      comunaName: p.comuna?.nombre ?? "",
      ufRate: uf,
      ufDate: dateISO,
      ufSource: source,
      ufCalc, // <— UF calculada para editar
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};



export const createPropiedad = async (req: Request, res: Response) => {
  try {
    // Subida de imágenes
    let imagenesUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      imagenesUrls = await uploadMultipleToCloudinary(req.files);
    }

    // Determinar imagen principal
    const mainImageName = req.body.mainImageName as string;
    let mainIdx = -1;
    if (mainImageName && req.files && Array.isArray(req.files)) {
      mainIdx = (req.files as any[]).findIndex(
        (f) => f.originalname === mainImageName
      );
    }

    let imagenUrl = '';
    let imagenesOrdenadas = imagenesUrls;
    if (mainIdx > -1 && imagenesUrls.length > 0) {
      imagenUrl = imagenesUrls[mainIdx];
      imagenesOrdenadas = [
        imagenesUrls[mainIdx],
        ...imagenesUrls.filter((_, idx) => idx !== mainIdx),
      ];
    } else {
      imagenUrl = imagenesUrls[0] || '';
    }

    // Destructurar campos, ahora usando statusId & typeId
    const {
      activo,
      titulo,
      descripcion,
      precio,
      bedrooms,
      bathrooms,
      area,
      address,
      lat,
      lng,
      parking,
      bodega,
      yearBuilt,
      expenses,
      publishedAt,
      usuarioId,
      comunaId,
      statusId,
      typeId,
    } = req.body;

    const propiedad = await prisma.propiedad.create({
      data: {
        activo: activo !== undefined ? Boolean(activo) : true,
        titulo,
        descripcion,
        precio: Number(precio),
        imagen: imagenUrl,
        imagenes: imagenesOrdenadas,
        status: { connect: { id: Number(statusId) } },
        type: { connect: { id: Number(typeId) } },
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        area: area ? Number(area) : undefined,
        address,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        parking: parking ? Number(parking) : undefined,
        bodega: bodega ? Number(bodega) : undefined,
        yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
        expenses: expenses ? Number(expenses) : undefined,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
        usuario: { connect: { id: Number(usuarioId) } },
        comuna: { connect: { id: Number(comunaId) } },
      },
    });

    res.status(201).json(propiedad);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updatePropiedad = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Subida de nuevas imágenes si las hay
    let nuevasImagenesUrls: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      nuevasImagenesUrls = await uploadMultipleToCloudinary(req.files);
    }

    // Mezclar con las existentes
    let imagenesTotales: string[] = [];
    if (req.body.imagenesExistentes) {
      try {
        imagenesTotales = JSON.parse(req.body.imagenesExistentes);
      } catch {
        imagenesTotales = [];
      }
    }
    imagenesTotales = imagenesTotales.concat(nuevasImagenesUrls);

    // Determinar principal
    const mainImageName = req.body.mainImageName as string;
    let imagenUrl = '';
    if (mainImageName && imagenesTotales.length > 0) {
      const found = imagenesTotales.find((imgUrl) =>
        imgUrl.includes(mainImageName)
      );
      imagenUrl = found || imagenesTotales[0];
    } else if (imagenesTotales.length > 0) {
      imagenUrl = imagenesTotales[0];
    }

    const {
      activo,
      titulo,
      descripcion,
      precio,
      bedrooms,
      bathrooms,
      area,
      address,
      lat,
      lng,
      parking,
      bodega,
      yearBuilt,
      expenses,
      publishedAt,
      usuarioId,
      comunaId,
      statusId,
      typeId,
    } = req.body;

    const updated = await prisma.propiedad.update({
      where: { id: Number(id) },
      data: {
        activo: activo !== undefined ? Boolean(activo) : undefined,
        titulo,
        descripcion,
        precio: precio ? Number(precio) : undefined,
        imagen: imagenUrl,
        imagenes: imagenesTotales,
        status: { connect: { id: Number(statusId) } },
        type: { connect: { id: Number(typeId) } },
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        area: area ? Number(area) : undefined,
        address,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        parking: parking ? Number(parking) : undefined,
        bodega: bodega ? Number(bodega) : undefined,
        yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
        expenses: expenses ? Number(expenses) : undefined,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
        usuario: usuarioId
          ? { connect: { id: Number(usuarioId) } }
          : undefined,
        comuna: comunaId
          ? { connect: { id: Number(comunaId) } }
          : undefined,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deletePropiedad = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.propiedad.delete({ where: { id: Number(id) } });
    res.json({ message: 'Propiedad eliminada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
