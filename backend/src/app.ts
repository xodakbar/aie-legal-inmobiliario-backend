import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import propiedadRoutes from './routes/propiedad.routes';

dotenv.config();

const app = express();

// Configura CORS para aceptar solo el frontend autorizado
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Middleware para parsear JSON
app.use(express.json());

// Middleware simple para logs (opcional)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Rutas de autenticación y propiedades
app.use('/api/auth', authRoutes);
app.use('/api/propiedades', propiedadRoutes);

export default app;
