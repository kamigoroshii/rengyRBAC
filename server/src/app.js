import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import userRoutes from './routes/userRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });

  console.log(`[api] incoming ${req.method} ${req.originalUrl}`);
  next();
});

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/auth', authRoutes);

console.log('[api] routes mounted: /api/health, /api/users, /api/teams, /api/permissions, /api/roles, /api/auth');

app.use(notFound);
app.use(errorHandler);

export default app;
