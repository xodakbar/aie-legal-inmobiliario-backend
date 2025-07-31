import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import cloudinary from '../utils/Cloudinary';


const prisma = new PrismaClient();

export const getPropiedades = async (req: Request, res: Response) => {
  try {
    // Filtros desde query params
    const {
      status,
      type,
      minPrecio,
      maxPrecio,
      bedrooms,
      bathrooms,
      location,
      page = 1,
      pageSize = 10,
      orderBy = 'createdAt:desc',
    } = req.query;

    // Prisma 'where' dinámico
    const where: any = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (bedrooms) where.bedrooms = Number(bedrooms);
    if (bathrooms) where.bathrooms = Number(bathrooms);
    if (location) where.location = { contains: String(location), mode: 'insensitive' };
    if (minPrecio || maxPrecio) {
      where.precio = {};
      if (minPrecio) where.precio.gte = Number(minPrecio);
      if (maxPrecio) where.precio.lte = Number(maxPrecio);
    }

    // Paginación y ordenamiento
    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    // Ordenamiento
    let [campo, sentido] = orderBy.toString().split(':');
    if (!['asc', 'desc'].includes(sentido)) sentido = 'desc'; // default

    // Consulta total (para frontend paginado)
    const total = await prisma.propiedad.count({ where });

    // Consulta paginada
    const propiedades = await prisma.propiedad.findMany({
      where,
      skip,
      take,
      orderBy: {
        [campo]: sentido,
      },
    });

    res.json({
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
      data: propiedades,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const uploadMultipleToCloudinary = (files: Express.Multer.File[]) =>
  Promise.all(files.map(file =>
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
  ));

export const createPropiedad = async (req: Request, res: Response) => {
  try {
    // Subir imágenes (si existen archivos)
    let imagenesUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      imagenesUrls = await uploadMultipleToCloudinary(req.files);
    }

    // Usa la primera imagen como principal
    let imagenUrl = imagenesUrls.length > 0 ? imagenesUrls[0] : '';

    // Resto de campos igual
    const {
      titulo, descripcion, precio,  status, type, bedrooms, bathrooms,
      area, address, lat, lng, parking, bodega, yearBuilt, expenses, publishedAt, usuarioId,comunaId
    } = req.body;

    const propiedad = await prisma.propiedad.create({
      data: {
        titulo,
        descripcion,
        precio: Number(precio),
        imagen: imagenUrl,
        imagenes: imagenesUrls,
        status,
        type,
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
        usuarioId: Number(usuarioId),
        comunaId: Number(comunaId), 
      },
    });

    res.status(201).json(propiedad);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};


export const updatePropiedad = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    let nuevasImagenesUrls: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      nuevasImagenesUrls = await uploadMultipleToCloudinary(req.files);
    }

    // Si recibes otras imágenes en el body (URLs antiguas), combínalas
    let imagenesTotales: string[] = [];
    if (req.body.imagenes) {
      try {
        imagenesTotales = JSON.parse(req.body.imagenes);
      } catch {
        imagenesTotales = [];
      }
    }
    // Agrega las nuevas imágenes subidas
    imagenesTotales = imagenesTotales.concat(nuevasImagenesUrls);

    // Usa la primera imagen como principal
    let imagenUrl = imagenesTotales.length > 0 ? imagenesTotales[0] : '';

    const updated = await prisma.propiedad.update({
      where: { id: Number(id) },
      data: {
        ...req.body,
        imagen: imagenUrl,
        imagenes: imagenesTotales,
        bedrooms: req.body.bedrooms ? Number(req.body.bedrooms) : undefined,
        bathrooms: req.body.bathrooms ? Number(req.body.bathrooms) : undefined,
        area: req.body.area ? Number(req.body.area) : undefined,
        lat: req.body.lat ? Number(req.body.lat) : undefined,
        lng: req.body.lng ? Number(req.body.lng) : undefined,
        parking: req.body.parking ? Number(req.body.parking) : undefined,
        bodega: req.body.bodega ? Number(req.body.bodega) : undefined,
        yearBuilt: req.body.yearBuilt ? Number(req.body.yearBuilt) : undefined,
        expenses: req.body.expenses ? Number(req.body.expenses) : undefined,
        publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : undefined,
        usuarioId: req.body.usuarioId ? Number(req.body.usuarioId) : undefined,
      }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};


export const deletePropiedad = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.propiedad.delete({ where: { id: Number(id) } });
    res.json({ message: 'Propiedad eliminada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getPropiedadById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const propiedad = await prisma.propiedad.findUnique({ where: { id: Number(id) } });
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.json(propiedad);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

