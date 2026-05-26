/**
 * server/src/index.js
 *
 * Entry point of the Express server.
 * Responsibilities:
 *  1. Load environment variables from .env
 *  2. Connect to MongoDB via Mongoose
 *  3. Ensure the default admin account exists (from .env credentials)
 *  4. Seed demo data (permissions, roles, teams, users, memberships)
 *  5. Start the HTTP server on the configured PORT
 *
 * Run locally:  npm run dev   (uses nodemon for auto-restart)
 * Run prod:     npm start     (plain node)
 */

import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';
import { ensureDefaultAdmin, seedDemoData } from './config/seed.js';

// Load .env variables into process.env before anything else
dotenv.config();

const port = process.env.PORT || 5000;

const start = async () => {
  try {
    // Step 1 — connect to MongoDB Atlas (or local Mongo)
    await connectDB();

    // Step 2 — create the admin user if it doesn't exist yet
    await ensureDefaultAdmin();

    // Step 3 — seed demo permissions, roles, teams, users, memberships
    //           (idempotent — safe to run on every restart)
    await seedDemoData();

    // Step 4 — start listening for HTTP requests
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

start();
