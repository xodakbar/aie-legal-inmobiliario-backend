// utils/uploadOptimizado.ts
import sharp from "sharp";
import crypto from "crypto";
import cld from "./Cloudinary";
type MulterFile = Express.Multer.File;

const MAX_DIM = 1920;
const SMALL_FILE_BYTES = 200 * 1024;

// --- helpers ---
const hashBuf = (buf: Buffer) => crypto.createHash("sha1").update(buf).digest("hex");
const isPngLike = (m?: string) => m?.includes("png") || m?.includes("svg");

// Normaliza y elige codec (igual que el tuyo, pequeño ajuste sin lossless si no hay alpha)
async function preprocesar(file: MulterFile) {
  const input = file.buffer;
  const meta = await sharp(input, { failOn: "none" }).metadata();
  const needsResize = !!meta.width && !!meta.height && (meta.width > MAX_DIM || meta.height > MAX_DIM);

  if (!needsResize && input.byteLength <= SMALL_FILE_BYTES) {
    const ext = (file.mimetype?.split("/")[1] ?? "jpg") as "jpg" | "jpeg" | "png" | "webp" | "avif";
    return { buf: input, ext };
  }

  const base = sharp(input, { failOn: "none" }).rotate().resize({
    width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true,
  });

  const hasAlpha = !!meta.hasAlpha;

  if (hasAlpha || isPngLike(file.mimetype)) {
    const webp = await base.webp({ quality: 80, effort: 4, alphaQuality: 90 }).toBuffer();
    return { buf: webp, ext: "webp" as const };
  } else {
    const [avif, webp] = await Promise.all([
      base.avif({ quality: 50, effort: 4 }).toBuffer(),
      base.webp({ quality: 78, effort: 4 }).toBuffer(),
    ]);
    return avif.byteLength <= webp.byteLength * 0.98
      ? { buf: avif, ext: "avif" as const }
      : { buf: webp, ext: "webp" as const };
  }
}

function uploadStreamCld(buf: Buffer, opts: { folder: string; public_id: string; format?: string }) {
  return new Promise<string>((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        folder: opts.folder,
        public_id: opts.public_id,   // nombre determinístico (hash)
        resource_type: "image",
        overwrite: false,            // NO pisar si ya existe
        format: opts.format,
      },
      (err, result) => (result?.secure_url ? resolve(result.secure_url) : reject(err))
    );
    stream.end(buf);
  });
}

// Consulta admin para saber si ya existe el recurso
async function getExistingUrl(public_id: string, format?: string) {
  try {
    const r = await cld.api.resource(public_id, { resource_type: "image" });
    return r.secure_url as string;
  } catch {
    // si no existe, devolvemos null
    return null;
  }
}

export const uploadMultipleToCloudinaryOptimizado = async (files: MulterFile[]) => {
  // (opcional) limitar concurrencia simple
  const CONC = 4;
  const queue = [...files];
  const results: string[] = [];

  async function worker() {
    while (queue.length) {
      const file = queue.shift()!;
      const { buf, ext } = await preprocesar(file);
      const hash = hashBuf(buf);                         // ← hash del contenido normalizado
      const public_id = `propiedades/${hash}`;           // ← dedupe a nivel global carpeta

      // 1) si existe, usa ese recurso
      const existing = await getExistingUrl(public_id, ext);
      if (existing) { results.push(existing); continue; }

      // 2) si no existe, sube una sola vez con el public_id = hash
      const url = await uploadStreamCld(buf, { folder: "", public_id, format: ext });
      results.push(url);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONC, files.length) }, () => worker()));
  return results;
};
