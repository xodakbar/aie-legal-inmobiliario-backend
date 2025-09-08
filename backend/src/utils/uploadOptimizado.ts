import sharp from "sharp";
import pLimit from "p-limit";
import cloudinary from "../utils/Cloudinary";

type MulterFile = Express.Multer.File;

const MAX_DIM = 1920;
const LIMIT = pLimit(4); // <= sube de a 4 en paralelo (ajústalo si quieres)
const SMALL_FILE_BYTES = 200 * 1024; // ~200 KB: umbral para no recomprimir

function isPngLike(mime?: string) {
  return mime?.includes("png") || mime?.includes("svg");
}

async function preprocesar(file: MulterFile) {
  const input = file.buffer;
  const meta = await sharp(input, { failOn: "none" }).metadata();
  const needsResize =
    !!meta.width && !!meta.height &&
    (meta.width > MAX_DIM || meta.height > MAX_DIM);

  // 1) Evitar recomprimir si ya es pequeño y no necesita resize
  if (!needsResize && input.byteLength <= SMALL_FILE_BYTES) {
    return { buf: input, ext: (file.mimetype?.split("/")[1] ?? "jpg") as "jpg" | "jpeg" | "png" | "webp" | "avif" };
  }

  // Pipeline base: rotar y limitar dimensiones
  const base = sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_DIM,
      height: MAX_DIM,
      fit: "inside",
      withoutEnlargement: true,
    });

  const hasAlpha = !!meta.hasAlpha;

  // 2) Decidir formato candidato(s)
  // - Si hay alpha o es PNG/ínfografico: WebP (lossless si es gráfico)
  // - Si es foto: probamos AVIF vs WebP con calidades medias y elegimos el menor
  if (hasAlpha || isPngLike(file.mimetype)) {
    // WebP lossless conserva transparencia sin artefactos
    const webp = await base.clone().webp({
      quality: 80, // se ignora en lossless pero deja margen si el codec decide híbrido
      lossless: true,
      effort: 4,
      alphaQuality: 90,
    }).toBuffer();

    return { buf: webp, ext: "webp" as const };
  } else {
    // Foto: AVIF vs WebP (elige el que pese menos)
    const [avif, webp] = await Promise.all([
      base.clone().avif({ quality: 50, effort: 4 }).toBuffer(), // AVIF suele ser muy eficiente a q~45-55
      base.clone().webp({ quality: 78, effort: 4 }).toBuffer(),
    ]);

    if (avif.byteLength <= webp.byteLength * 0.98) {
      return { buf: avif, ext: "avif" as const };
    }
    return { buf: webp, ext: "webp" as const };
  }
}

function uploadStreamCld(buf: Buffer, opts: { folder: string; publicId?: string; format?: string }) {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder,
        resource_type: "image",
        use_filename: !!opts.publicId,
        unique_filename: !opts.publicId,
        overwrite: false,
        format: opts.format, // fuerza extensión elegida (avif/webp/png/jpg)
      },
      (err, result) => result?.secure_url ? resolve(result.secure_url) : reject(err)
    );
    stream.end(buf);
  });
}

export const uploadMultipleToCloudinaryOptimizado = (files: MulterFile[]) =>
  Promise.all(
    files.map((file) =>
      LIMIT(async () => {
        const { buf, ext } = await preprocesar(file);
        // Public ID limpio (opcional)
        const baseName = (file.originalname || "img")
          .replace(/\.[a-zA-Z0-9]+$/, "")
          .replace(/[^a-zA-Z0-9-_]+/g, "-")
          .slice(0, 80);

        const url = await uploadStreamCld(buf, {
          folder: "propiedades",
          publicId: baseName,       // deja que Cloudinary agregue sufijo si hay colisión (unique_filename:false => lo respetaría, pero aquí usamos use_filename con unique true por default)
          format: ext,              // sube con la extensión/codec final elegido
        });

        return url;
      })
    )
  );
