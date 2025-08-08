// src/controllers/property.controller.ts

import { Request, Response } from 'express';
import {
  PrismaClient,
  Prisma
} from '@prisma/client';
import cloudinary from '../utils/Cloudinary';

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


type PropiedadFull = Awaited<ReturnType<typeof prisma.propiedad.findMany>>[number];

export const getPropiedades = async (req: Request, res: Response) => {
  try {
    const {
      statusId,
      typeId,
      activo,
      minPrecio,
      maxPrecio,
      bedrooms,
      bathrooms,
      regionId,
      ciudadId,
      comunaId,
      page = '1',
      pageSize = '10',
      orderBy = 'createdAt:desc',
    } = req.query;

    // Construir filtro dinámico
    const where: any = {};
    if (statusId) where.statusId = Number(statusId);
    if (typeId) where.typeId = Number(typeId);
    if (activo !== undefined) where.activo = activo === 'true';
    if (bedrooms) where.bedrooms = Number(bedrooms);
    if (bathrooms) where.bathrooms = Number(bathrooms);
    if (comunaId) where.comunaId = Number(comunaId);
    if (minPrecio || maxPrecio) {
      where.precio = {};
      if (minPrecio) where.precio.gte = Number(minPrecio);
      if (maxPrecio) where.precio.lte = Number(maxPrecio);
    }

    // Paginación y orden
    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);
    let [campo, sentido] = orderBy.toString().split(':');
    if (!['asc', 'desc'].includes(sentido)) sentido = 'desc';


    
    // Consulta con relaciones
     const propiedades = (await prisma.propiedad.findMany({
      where,
      skip,
      take,
      orderBy: { [campo]: sentido },
      include: {
        comuna: {
          include: {
            ciudad: { include: { region: true } }
          }
        },
        status: true,
        type:   true
      }
    })) as PropiedadFull[];

    // Filtros adicionales de ciudad y región
    let filtered: PropiedadFull[] = propiedades;
    if (ciudadId) {
      filtered = filtered.filter((p: PropiedadFull) =>
        p.comuna.ciudad.id === Number(ciudadId)
      );
    }
    if (regionId) {
      filtered = filtered.filter((p: PropiedadFull) =>
        p.comuna.ciudad.region.id === Number(regionId)
      );
    }

    res.json({
      total: filtered.length,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(filtered.length / Number(pageSize)),
      data: filtered,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPropiedadById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const propiedad = await prisma.propiedad.findUnique({
      where: { id: Number(id) },
      include: {
        comuna: {
          include: {
            ciudad: {
              include: { region: true },
            },
          },
        },
        status: true,
        type: true,
      },
    });
    if (!propiedad)
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.json(propiedad);
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
