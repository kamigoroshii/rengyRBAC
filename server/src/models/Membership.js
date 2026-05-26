/**
 * server/src/models/Membership.js
 *
 * Mongoose schema for a Membership — the core of the RBAC system.
 *
 * A Membership is the JOIN between a User, a Team, and one or more Roles.
 * This is what makes the RBAC "team-scoped":
 *   - Alice can be Admin in Team Alpha (full permissions)
 *   - Alice can be Viewer in Team Beta (read-only)
 *   - Same user, completely different permissions per team
 *
 * Fields:
 *  user  — reference to the User
 *  team  — reference to the Team
 *  roles — array of Role references (supports multiple roles per membership)
 *
 * Compound unique index on (user, team):
 *  Ensures a user can only have ONE membership record per team.
 *  Multiple roles are stored in the roles array of that single record.
 *  Upsert pattern: findOneAndUpdate({ user, team }, { $set: { roles } }, { upsert: true })
 *
 * Permission resolution flow:
 *  1. Find Membership where user=X and team=Y
 *  2. Populate roles → populate permissions
 *  3. Flatten all permissions from all roles (deduplicated by Map)
 *  4. Return the unique permission list
 */

import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    // The user who belongs to this team
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The team this membership belongs to
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    // The roles this user has within this specific team
    // A user can have multiple roles in the same team
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
  },
  { timestamps: true }
);

// Compound unique index — one membership record per user per team
// This prevents duplicate memberships and enables efficient upserts
membershipSchema.index({ user: 1, team: 1 }, { unique: true });

export const Membership = mongoose.model('Membership', membershipSchema);
