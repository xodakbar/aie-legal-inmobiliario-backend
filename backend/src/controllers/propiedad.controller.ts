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
      regionId,
      ciudadId,
      comunaId,
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
    if (comunaId) where.comunaId = Number(comunaId);
    // city/region filter via nested relation (optional)
    // Puedes usarlo en un segundo filtro JS si quieres

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

    // Ahora hacemos include de comuna → ciudad → region
    const propiedades = await prisma.propiedad.findMany({
      where,
      skip,
      take,
      orderBy: {
        [campo]: sentido,
      },
      include: {
        comuna: {
          include: {
            ciudad: {
              include: {
                region: true,
              },
            },
          },
        },
      },
    });

    // Filtro adicional por ciudad o region si llegan por query
    let filtered = propiedades;
    if (ciudadId) {
      filtered = filtered.filter(
        p => p.comuna && p.comuna.ciudad && p.comuna.ciudad.id === Number(ciudadId)
      );
    }
    if (regionId) {
      filtered = filtered.filter(
        p =>
          p.comuna &&
          p.comuna.ciudad &&
          p.comuna.ciudad.region &&
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

    // Recibe el nombre de la imagen principal desde el frontend
    const mainImageName: string = req.body.mainImageName;

    // Encuentra el índice de la imagen principal según el nombre
    let mainIdx = -1;
    if (mainImageName && req.files && Array.isArray(req.files)) {
      mainIdx = req.files.findIndex((f: any) => f.originalname === mainImageName);
    }

    // Ordena el array para que la principal quede primera
    let imagenesOrdenadas = imagenesUrls;
    let imagenUrl = '';
    if (mainIdx > -1 && imagenesUrls.length > 0) {
      imagenUrl = imagenesUrls[mainIdx];
      imagenesOrdenadas = [
        imagenesUrls[mainIdx],
        ...imagenesUrls.filter((_, idx) => idx !== mainIdx),
      ];
    } else {
      imagenUrl = imagenesUrls.length > 0 ? imagenesUrls[0] : '';
    }

    // Resto de campos igual
    const {
      titulo, descripcion, precio, status, type, bedrooms, bathrooms,
      area, address, lat, lng, parking, bodega, yearBuilt, expenses,
      publishedAt, usuarioId, comunaId
    } = req.body;

    const propiedad = await prisma.propiedad.create({
      data: {
        titulo,
        descripcion,
        precio: Number(precio),
        imagen: imagenUrl,            // <- Principal
        imagenes: imagenesOrdenadas,  // <- Todas, principal primero
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
    console.log('REQ.BODY:', req.body);


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

    // Lee el campo de imágenes existentes (importante: busca el nombre correcto)
    let imagenesTotales: string[] = [];
    if (req.body.imagenesExistentes) {
      try {
        imagenesTotales = JSON.parse(req.body.imagenesExistentes);
      } catch {
        imagenesTotales = [];
      }
    }
    // Agrega las nuevas imágenes subidas (si hay)
    imagenesTotales = imagenesTotales.concat(nuevasImagenesUrls);

    // Encuentra cuál es la imagen principal
    let imagenUrl = '';
    const mainImageName = req.body.mainImageName;
    if (mainImageName && imagenesTotales.length > 0) {
      // Busca el URL que coincide con el nombre (para nuevas o antiguas)
      const found = imagenesTotales.find(imgUrl => {
        // Para nuevas: Cloudinary URLs, para antiguas: ya es URL
        // Compara el final de la URL con el nombre de archivo
        return imgUrl.includes(mainImageName);
      });
      imagenUrl = found || imagenesTotales[0];
    } else if (imagenesTotales.length > 0) {
      imagenUrl = imagenesTotales[0];
    }

    // Resto igual
    const updated = await prisma.propiedad.update({
      where: { id: Number(id) },
      data: {
        titulo: req.body.titulo,
        descripcion: req.body.descripcion,
        precio: req.body.precio ? Number(req.body.precio) : undefined,
        imagen: imagenUrl,
        imagenes: imagenesTotales,
        status: req.body.status,
        type: req.body.type,
        bedrooms: req.body.bedrooms ? Number(req.body.bedrooms) : undefined,
        bathrooms: req.body.bathrooms ? Number(req.body.bathrooms) : undefined,
        area: req.body.area ? Number(req.body.area) : undefined,
        address: req.body.address,
        lat: req.body.lat ? Number(req.body.lat) : undefined,
        lng: req.body.lng ? Number(req.body.lng) : undefined,
        parking: req.body.parking ? Number(req.body.parking) : undefined,
        bodega: req.body.bodega ? Number(req.body.bodega) : undefined,
        yearBuilt: req.body.yearBuilt ? Number(req.body.yearBuilt) : undefined,
        expenses: req.body.expenses ? Number(req.body.expenses) : undefined,
        publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : undefined,
        usuarioId: req.body.usuarioId ? Number(req.body.usuarioId) : undefined,
        comunaId: req.body.comunaId ? Number(req.body.comunaId) : undefined,
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

// propiedad.controller.ts
export const getPropiedadById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const propiedad = await prisma.propiedad.findUnique({
      where: { id: Number(id) },
      include: {
        comuna: {
          include: {
            ciudad: {
              include: { region: true }
            }
          }
        }
      }
    });
    if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
    res.json(propiedad);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};


