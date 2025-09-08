// src/middlewares/upload.middleware.ts
import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB por archivo (ajusta a gusto)
    files: 40,                  // máx. 40 imágenes por request
  },
  fileFilter: (_req, file, cb) => {
    // Acepta solo imágenes
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo se permiten imágenes"));
  },
});

export default upload;
