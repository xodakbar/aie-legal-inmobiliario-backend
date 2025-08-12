// src/routes/status.routes.ts
import { Router } from 'express';
import { getStatuses } from '../controllers/status.controller';
const router = Router();

router.get('/status', getStatuses);

export default router;
