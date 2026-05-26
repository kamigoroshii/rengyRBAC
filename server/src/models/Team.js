/**
 * server/src/models/Team.js
 *
 * Mongoose schema for a Team.
 *
 * A team is a group that users can be members of.
 * Teams don't store their members directly — membership is managed
 * through the Membership collection (User ↔ Team ↔ Roles).
 *
 * Fields:
 *  name        — unique team name (e.g. "Team Alpha")
 *  description — optional human-readable description
 */

import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true, // no two teams can have the same name
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

export const Team = mongoose.model('Team', teamSchema);
