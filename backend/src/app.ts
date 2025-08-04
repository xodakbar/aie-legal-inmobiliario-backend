import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import propiedadRoutes from './routes/propiedad.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import comunasRoutes from './routes/comunas.routes';
import regionRoutes from "./routes/region.routes";
import ciudadRoutes from "./routes/ciudad.routes";

dotenv.config();

const app = express();

// Configura CORS para aceptar solo el frontend autorizado
app.use(cors({
  origin: process.env.FRONTEND_URL,
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

app.use('/api/users', userRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/comunas', comunasRoutes);

app.use("/api/regiones", regionRoutes);
app.use("/api/ciudades", ciudadRoutes);

export default app;
