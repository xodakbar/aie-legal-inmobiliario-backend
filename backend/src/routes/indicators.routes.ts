import { Router } from 'express';
import { getUfRate, convertAmount } from '../controllers/indicator.controller';
const router = Router();

router.get('/uf', getUfRate);
router.get('/convert', convertAmount);

export default router;
