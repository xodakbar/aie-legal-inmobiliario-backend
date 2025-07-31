import multer from 'multer';

const storage = multer.memoryStorage(); // almacena los archivos en memoria RAM para fácil subida a Cloudinary

const upload = multer({ storage });

export default upload;
