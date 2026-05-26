/**
 * server/src/models/User.js
 *
 * Mongoose schema for a system user.
 *
 * Fields:
 *  name         — display name
 *  email        — unique login identifier (stored lowercase)
 *  passwordHash — bcrypt hash, excluded from queries by default (select: false)
 *                 so it never accidentally leaks in API responses
 *  accountType  — 'admin' can manage the whole system via the admin UI
 *                 'employee' can only view their own access (Overview + My Access)
 *
 * Important design decision:
 *  Roles are NOT stored on the User document.
 *  A user's roles are stored in the Membership collection, scoped per team.
 *  This allows the same user to have different roles in different teams.
 *
 * timestamps: true adds createdAt and updatedAt automatically.
 */

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // removes leading/trailing whitespace
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // always stored as lowercase for consistent lookups
      unique: true,    // enforced at DB level with a unique index
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned in queries unless explicitly requested
    },
    accountType: {
      type: String,
      enum: ['admin', 'employee'], // only two valid values
      default: 'employee',
    },
  },
  { timestamps: true } // adds createdAt, updatedAt
);

export const User = mongoose.model('User', userSchema);
