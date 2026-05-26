/**
 * server/src/app.js
 *
 * Express application setup — middleware stack and route mounting.
 *
 * Middleware order (matters):
 *  1. Request logger  — logs every incoming request and its response time
 *  2. Helmet          — sets secure HTTP headers (XSS, clickjacking, etc.)
 *  3. CORS            — allows the frontend origin(s) to call this API
 *  4. express.json()  — parses JSON request bodies
 *
 * Routes mounted:
 *  /api/health       — simple liveness check (no auth required)
 *  /api/auth         — sign-up, sign-in, /me
 *  /api/users        — create and list users
 *  /api/teams        — create, list, membership management
 *  /api/permissions  — create and list permissions
 *  /api/roles        — create, list, assign permissions to roles
 *
 * Error handling:
 *  notFound    — catches any unmatched route and returns 404
 *  errorHandler — central error formatter, hides stack trace in production
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import userRoutes       from './routes/userRoutes.js';
import teamRoutes       from './routes/teamRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import roleRoutes       from './routes/roleRoutes.js';
import authRoutes       from './routes/authRoutes.js';
import { errorHandler, notFound } from './middleware/error.js';

// Needed for __dirname in ES modules (Node doesn't provide it by default)
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

/* ── 1. Request logger ──────────────────────────────────── */
app.use((req, res, next) => {
  const startedAt = Date.now();
  // Log response time after the response finishes
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

/* ── 2. Security headers (Helmet) ───────────────────────── */
app.use(helmet());

/* ── 3. CORS ────────────────────────────────────────────── */
// CLIENT_ORIGIN can be a comma-separated list for multiple environments
// e.g. "http://localhost:5173,https://rengy-rbac.vercel.app"
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin header (Postman, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true, // allow cookies / Authorization headers
  })
);

/* ── 4. Body parser ─────────────────────────────────────── */
app.use(express.json());

/* ── Routes ─────────────────────────────────────────────── */
// Health check — used by Render to verify the server is alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV });
});

app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/teams',       teamRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles',       roleRoutes);

console.log('[api] routes mounted');

/* ── Error handling (must be last) ─────────────────────── */
app.use(notFound);      // 404 for any unmatched route
app.use(errorHandler);  // formats all thrown errors into JSON responses

export default app;
