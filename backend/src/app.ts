import express from 'express';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

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
import publicRoutes from "./routes/public.routes";

dotenv.config();

const app = express();

/* ===================== CORS FIRST ===================== */

const defaultOrigins = [
  "https://ayelegaleinmobiliario.cl",
  "https://www.ayelegaleinmobiliario.cl",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const allowedOriginsFromEnv = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const rawAllowed = allowedOriginsFromEnv.length ? allowedOriginsFromEnv : defaultOrigins;

const normalize = (o?: string) =>
  (o || "").toLowerCase().replace(/\/+$/, ""); // sin slash final

const allowedSet = new Set(rawAllowed.map(normalize));

function isAllowedOrigin(origin?: string) {
  if (!origin) return true; // curl/Postman/SSR
  const o = normalize(origin);
  if (allowedSet.has(o)) return true;
  // Previews de Netlify (opcional)
  if (o.endsWith(".netlify.app")) return true;
  return false;
}

const corsOptions: CorsOptions = {
  origin(origin, cb) {
    if (isAllowedOrigin(origin)) return cb(null, true);
    console.warn(`CORS bloqueado para: ${origin}`);
    return cb(new Error("No permitido por CORS"));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  // ❌ No fijamos allowedHeaders para que CORS refleje lo que pide el navegador
  // allowedHeaders: ["Content-Type","Authorization"],  // <-- quitalo
  maxAge: 86400,
};

app.use((req, _res, next) => {
  // Log útil para depurar preflight
  if (req.method === "OPTIONS") {
    console.log("[CORS] OPTIONS",
      { origin: req.headers.origin, acrh: req.headers["access-control-request-headers"] }
    );
  } else {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | Origin: ${req.headers.origin}`);
  }
  next();
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight global
/* ====================================================== */


app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json());

// Log útil para ver el Origin real que llega
app.use((req, _res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.path} | Origin: ${req.headers.origin}`
  );
  next();
});

/* RUTAS (todas con prefijo /api) */
app.use('/api/auth', authRoutes);
app.use('/api/propiedades', propiedadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/comunas', comunasRoutes);
app.use('/api/regiones', regionRoutes);
app.use('/api/ciudades', ciudadRoutes);
app.use('/api/indicators', indicatorsRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/types', typeRoutes);
app.use('/api', publicRoutes);

// Healthcheck sin DB para probar CORS rápido
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Manejador global de errores (garantiza JSON)
app.use((
  err: any,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
