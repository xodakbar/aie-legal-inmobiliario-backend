import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import propiedadRoutes from './routes/propiedad.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import comunasRoutes from './routes/comunas.routes';
import regionRoutes from './routes/region.routes';
import ciudadRoutes from './routes/ciudad.routes';
import indicatorsRoutes from './routes/indicators.routes';
import statusRoutes from './routes/status.routes';
import typeRoutes from './routes/type.routes';
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();

// Lista fija de orígenes permitidos (producción + desarrollo)
const allowedOrigins = [
  'https://aie-inmobiliria-lgeal.netlify.app',
  'http://localhost:5173',
];
app.set("trust proxy", 1);
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS bloqueado: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/propiedades', propiedadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/comunas', comunasRoutes);
app.use('/api/regiones', regionRoutes);
app.use('/api/ciudades', ciudadRoutes);
app.use('/api/indicators', indicatorsRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/types',  typeRoutes);

export default app;
