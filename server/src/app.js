import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import userRoutes from './routes/userRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { errorHandler, notFound } from './middleware/error.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use(helmet());

// Accept multiple origins: local dev + any deployed frontend URL from CLIENT_ORIGIN
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, same-origin)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV });
});

app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/auth', authRoutes);

console.log('[api] routes mounted');

app.use(notFound);
app.use(errorHandler);

export default app;
