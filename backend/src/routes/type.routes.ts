// src/routes/type.routes.ts
import { Router } from 'express';
import { getPropertyTypes } from '../controllers/type.controller';
const router = Router();

router.get('/types', getPropertyTypes);

export default router;
