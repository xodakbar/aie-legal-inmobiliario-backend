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

dotenv.config();

const app = express();

// Lista fija de orígenes permitidos (producción + desarrollo)
const allowedOrigins = [
  'https://aie-inmobiliria-lgeal.netlify.app',
  'http://localhost:5174',
];

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

export default app;
