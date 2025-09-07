// src/routes/public.routes.ts
import { Router } from "express";
import { contact } from "../controllers/public.controller";
const router = Router();

router.post("/contact", contact);
export default router;
