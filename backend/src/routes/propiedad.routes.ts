import { Router } from 'express';
import { getPropiedades, createPropiedad, getPropiedadById } from '../controllers/propiedad.controller';
import upload from '../middlewares/upload.middleware';
import { updatePropiedad, deletePropiedad } from '../controllers/propiedad.controller';

const router = Router();

router.get('/', getPropiedades);
router.post('/', upload.array('imagenes', 10), createPropiedad);
router.put('/:id', upload.array('imagenes', 10), updatePropiedad);

router.put('/:id', upload.single('imagen'), updatePropiedad);
router.delete('/:id', deletePropiedad);

router.get('/:id', getPropiedadById);


export default router;
