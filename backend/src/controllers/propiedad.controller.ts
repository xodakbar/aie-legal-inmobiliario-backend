// src/controllers/propiedad.controller.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import cloudinary from "../utils/Cloudinary";
import { clpToUf, fetchUf } from "../services/uf.service";
import { uploadMultipleToCloudinaryOptimizado } from "../utils/uploadOptimizado";

type MulterFile = Express.Multer.File;

// Prisma Client
const prisma = new PrismaClient();


/* ------------------------- SELECT mínimo para listados ------------------------- */
const listadoSelect = {
  id: true,
  titulo: true,
  precio: true,
  imagen: true,
  bedrooms: true,
  bathrooms: true,
  area: true,
  builtArea: true,
  createdAt: true,
  activo: true,
  status: { select: { name: true } },
  type: { select: { name: true } },
  comuna: {
    select: {
      nombre: true,
      ciudad: {
        select: {
          nombre: true,
          region: { select: { nombre: true } },
        },
      },
    },
  },
} as const;

/* ------------------------- DTO ------------------------- */
type PropiedadDTO = {
  id: number;
  titulo: string;
  precio: number;
  precioUf: number | null;
  imagen: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  builtArea: number | null;
  createdAt: Date;
  activo: boolean;
  status: string;
  type: string;
  region: string;
  ciudad: string;
  comuna: string;
};

const toDTO = (p: any, ufRate?: number): PropiedadDTO => ({
  id: p.id,
  titulo: p.titulo,
  precio: p.precio,
  imagen: p.imagen,
  precioUf: ufRate ? Number((p.precio / (ufRate || 1)).toFixed(2)) : null,
  bedrooms: p.bedrooms ?? null,
  bathrooms: p.bathrooms ?? null,
  area: p.area ?? null,
  builtArea: p.builtArea ?? null, // <- corregido (antes leía p.area)
  createdAt: p.createdAt,
  status: p.status?.name ?? "",
  type: p.type?.name ?? "",
  region: p.comuna?.ciudad?.region?.nombre ?? "",
  ciudad: p.comuna?.ciudad?.nombre ?? "",
  comuna: p.comuna?.nombre ?? "",
  activo: Boolean(p.activo),
});

/* ------------------------- Orden seguro ------------------------- */
type SortOrder = "asc" | "desc";
const ORDER_WHITELIST = new Set<"id" | "createdAt" | "precio" | "titulo">([
  "id",
  "createdAt",
  "precio",
  "titulo",
]);

/* =========================================================
 *                      CONTROLADORES
 * =======================================================*/

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
      page = "1",
      pageSize = "10",
      orderBy = "createdAt:desc",
      q,
      titulo,
    } = req.query as any;

    // Orden seguro
    let [campoRaw, sentidoRaw] = orderBy.toString().split(":");
    const campo = ORDER_WHITELIST.has(campoRaw as any)
      ? (campoRaw as "id" | "createdAt" | "precio" | "titulo")
      : "createdAt";
    const sentido: SortOrder =
      sentidoRaw === "asc" || sentidoRaw === "desc" ? sentidoRaw : ("desc" as const);

    // Filtros (sin tipos Prisma)
    const and: any[] = [];
    if (statusId) and.push({ statusId: Number(statusId) });
    if (typeId) and.push({ typeId: Number(typeId) });
    if (activo !== undefined) {
      const v = String(activo).trim().toLowerCase();
      const activoBool = v === "true" || v === "1" || v === "yes" || v === "on";
      and.push({ activo: activoBool });
    }
    if (q || titulo) {
      and.push({
        titulo: {
          contains: String(q || titulo),
          mode: "insensitive",
        },
      });
    }
    if (bedrooms) and.push({ bedrooms: Number(bedrooms) });
    if (bathrooms) and.push({ bathrooms: Number(bathrooms) });
    if (comunaId) and.push({ comunaId: Number(comunaId) });
    if (ciudadId) and.push({ comuna: { ciudadId: Number(ciudadId) } });
    if (regionId) and.push({ comuna: { ciudad: { regionId: Number(regionId) } } });

    if (minPrecio || maxPrecio) {
      const precio: { gte?: number; lte?: number } = {};
      if (minPrecio) precio.gte = Number(minPrecio);
      if (maxPrecio) precio.lte = Number(maxPrecio);
      and.push({ precio });
    }

    const where: any = and.length ? { AND: and } : {};

    // Paginación
    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    // Query
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

    // UF del día
    let ufRate = 0,
      ufDate = "",
      ufSource: "cache" | "env" | "external" | undefined = undefined;
    try {
      const uf = await fetchUf();
      ufRate = uf.uf;
      ufDate = uf.dateISO;
      ufSource = uf.source;
    } catch {
      // si falla, respondemos sin precioUf
    }

    // Map a DTO
    const data: PropiedadDTO[] = rows.map((p: any) => toDTO(p, ufRate));

    res.json({
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
      ufRate: ufRate || undefined,
      ufDate: ufDate || undefined,
      ufSource,
      data,
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

    // UF del día y cálculo sugerido
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
      ufCalc, // para editar
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/* ------------------------- Helpers extra ------------------------- */
type AuthRequest = Request & { user?: { id: number; rol?: string } };

const parseBool = (v: any): boolean => {
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on" || s === "sí" || s === "si";
};

const MAX_FOTOS_DEF = 36;

function toNum(v: any) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function tryParseJSON<T = any>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  try {
    if (typeof raw === "string") return JSON.parse(raw) as T;
    return (raw as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Reordena poniendo `principal` al inicio si existe dentro del array */
function reorderWithMain(urls: string[], principal?: string) {
  if (!principal) return urls;
  const idx = urls.findIndex((u) => u === principal);
  if (idx <= 0) return urls; // -1 o ya es primera
  return [urls[idx], ...urls.filter((_, i) => i !== idx)];
}

/** Dedup preservando orden (primera ocurrencia gana) */
function dedupePreserve<T>(arr: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const key = String(it);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

/* ------------------------- Crear propiedad ------------------------- */
export const createPropiedad = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    // Subida de imágenes (OPTIMIZADA)
    let imagenesUrls: string[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      imagenesUrls = await uploadMultipleToCloudinaryOptimizado(req.files as Express.Multer.File[]);
    }

    // Determinar imagen principal según el nombre original que llega desde el front
    const mainImageName = req.body.mainImageName as string | undefined;
    let mainIdx = -1;
    if (mainImageName && req.files && Array.isArray(req.files)) {
      mainIdx = (req.files as Express.Multer.File[]).findIndex(
        (f) => f.originalname === mainImageName
      );
    }

    let imagenUrl = "";
    let imagenesOrdenadas = imagenesUrls;
    if (mainIdx > -1 && imagenesUrls.length > 0 && mainIdx < imagenesUrls.length) {
      imagenUrl = imagenesUrls[mainIdx];
      imagenesOrdenadas = [
        imagenesUrls[mainIdx],
        ...imagenesUrls.filter((_, idx) => idx !== mainIdx),
      ];
    } else {
      imagenUrl = imagenesUrls[0] || "";
    }

    // Campos
    const {
      activo,
      titulo,
      descripcion,
      precio,
      bedrooms,
      bathrooms,
      area,
      builtArea,
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
        activo: activo !== undefined ? parseBool(activo) : true,
        titulo,
        descripcion,
        precio: Number(precio ?? 0),
        imagen: imagenUrl,
        imagenes: imagenesOrdenadas,
        status: { connect: { id: Number(statusId) } },
        type: { connect: { id: Number(typeId) } },
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        area: area ? Number(area) : undefined,
        builtArea: builtArea ? Number(builtArea) : undefined,
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

/* ------------------------- Actualizar propiedad ------------------------- */
export const updatePropiedad = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1) Subida de nuevas imágenes (optimizada)
    const files: MulterFile[] = (Array.isArray(req.files) ? (req.files as MulterFile[]) : []) || [];
    const nuevasImagenesUrls: string[] = files.length
      ? await uploadMultipleToCloudinaryOptimizado(files)
      : [];

    // 2) Tomar existentes y opcionalmente eliminar algunas (si lo envías)
    let existentes: string[] = tryParseJSON<string[]>(req.body.imagenesExistentes, []);
    const aEliminar: string[] = tryParseJSON<string[]>(req.body.imagenesAEliminar, []);
    if (aEliminar.length) {
      const remove = new Set(aEliminar);
      existentes = existentes.filter((u) => !remove.has(u));
    }

    // 3) Mezclar + desduplicar + limitar a un máximo
    const maxFotos = toNum(req.body.maxFotos) ?? MAX_FOTOS_DEF;
    let imagenesTotales = dedupePreserve<string>([
      ...existentes,
      ...nuevasImagenesUrls,
    ]).slice(0, maxFotos);

    // 4) Determinar principal: por URL / índice / nombre original
    const mainImageUrl = (req.body.mainImageUrl as string | undefined) || undefined;
    const mainImageIndex = toNum(req.body.mainImageIndex);
    const mainImageName = (req.body.mainImageName as string | undefined) || undefined;

    let principal: string | undefined;

    // a) Coincidencia exacta por URL
    if (mainImageUrl && imagenesTotales.includes(mainImageUrl)) {
      principal = mainImageUrl;
    }

    // b) Índice dentro del array
    if (
      !principal &&
      mainImageIndex !== undefined &&
      mainImageIndex! >= 0 &&
      mainImageIndex! < imagenesTotales.length
    ) {
      principal = imagenesTotales[mainImageIndex!];
    }

    // c) Coincidencia por nombre (substring en URL) o mapeo por archivo recién subido
    if (!principal && mainImageName) {
      const byName = imagenesTotales.find((u) => u.includes(mainImageName));
      if (byName) principal = byName;

      if (!principal && files.length && nuevasImagenesUrls.length) {
        const idxFile = files.findIndex((f) => f.originalname === mainImageName);
        if (idxFile > -1 && nuevasImagenesUrls[idxFile]) {
          principal = nuevasImagenesUrls[idxFile];
        }
      }
    }

    if (principal) {
      imagenesTotales = reorderWithMain(imagenesTotales, principal);
    }

    // 5) Detectar si realmente hubo cambios en imágenes
    const huboCambioImagenes =
      files.length > 0 || aEliminar.length > 0 || !!principal || !!req.body.reorder;

    // 6) Construir payload de update (parcial)
    const {
      activo,
      titulo,
      descripcion,
      precio,
      bedrooms,
      bathrooms,
      area,
      builtArea,
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

    const dataUpdate: any = {
      ...(activo !== undefined ? { activo: parseBool(activo) } : {}),
      ...(titulo !== undefined ? { titulo } : {}),
      ...(descripcion !== undefined ? { descripcion } : {}),
      ...(precio !== undefined ? { precio: toNum(precio) } : {}),
      ...(bedrooms !== undefined ? { bedrooms: toNum(bedrooms) } : {}),
      ...(bathrooms !== undefined ? { bathrooms: toNum(bathrooms) } : {}),
      ...(area !== undefined ? { area: toNum(area) } : {}),
      ...(builtArea !== undefined ? { builtArea: toNum(builtArea) } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(lat !== undefined ? { lat: toNum(lat) } : {}),
      ...(lng !== undefined ? { lng: toNum(lng) } : {}),
      ...(parking !== undefined ? { parking: toNum(parking) } : {}),
      ...(bodega !== undefined ? { bodega: toNum(bodega) } : {}),
      ...(yearBuilt !== undefined ? { yearBuilt: toNum(yearBuilt) } : {}),
      ...(expenses !== undefined ? { expenses: toNum(expenses) } : {}),
      ...(publishedAt !== undefined
        ? { publishedAt: publishedAt ? new Date(publishedAt) : null }
        : {}),
    };

    if (huboCambioImagenes) {
      dataUpdate.imagenes = imagenesTotales;
      dataUpdate.imagen = imagenesTotales[0] ?? "";
    }

    // Relaciones: conectar solo si vienen IDs
    if (statusId !== undefined) {
      dataUpdate.status = { connect: { id: Number(statusId) } };
    }
    if (typeId !== undefined) {
      dataUpdate.type = { connect: { id: Number(typeId) } };
    }
    if (usuarioId !== undefined) {
      dataUpdate.usuario = { connect: { id: Number(usuarioId) } };
    }
    if (comunaId !== undefined) {
      dataUpdate.comuna = { connect: { id: Number(comunaId) } };
    }

    const updated = await prisma.propiedad.update({
      where: { id: Number(id) },
      data: dataUpdate,
    });

    res.json(updated);
  } catch (error: any) {
    console.error("updatePropiedad error:", error);
    res.status(400).json({ error: error.message });
  }
};

/* ------------------------- Eliminar propiedad ------------------------- */
export const deletePropiedad = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.propiedad.delete({ where: { id: Number(id) } });
    res.json({ message: "Propiedad eliminada" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
