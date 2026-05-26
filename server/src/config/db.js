/**
 * server/src/config/db.js
 *
 * MongoDB connection setup using Mongoose.
 *
 * Called once at server startup (index.js).
 * Reads MONGODB_URI from environment variables.
 *
 * strictQuery: true  — Mongoose will ignore query fields that are not
 *                       in the schema, preventing accidental data leaks.
 */

import mongoose from 'mongoose';

export const connectDB = async () => {
  // Fail fast if the connection string is missing
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  // Suppress Mongoose deprecation warning about query filtering
  mongoose.set('strictQuery', true);

  // Connect — Mongoose handles connection pooling automatically
  await mongoose.connect(process.env.MONGODB_URI);
};
