import { Router } from 'express';
import { getUfRate } from '../controllers/indicator.controller';
const router = Router();
router.get('/uf', getUfRate);

export default router;
