import { Router } from 'express';
import { getPropiedades, createPropiedad } from '../controllers/propiedad.controller';
import upload from '../middlewares/upload.middleware';
import { updatePropiedad, deletePropiedad } from '../controllers/propiedad.controller';

const router = Router();

router.get('/', getPropiedades);
router.post('/', upload.array('imagenes', 10), createPropiedad);

router.put('/:id', upload.single('imagen'), updatePropiedad);
router.delete('/:id', deletePropiedad);

export default router;
