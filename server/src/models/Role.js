/**
 * server/src/models/Role.js
 *
 * Mongoose schema for a Role.
 *
 * A role is a named bundle of permissions (e.g. "Manager" = CREATE_TASK + EDIT_TASK).
 * Roles are global — they are not tied to any specific team.
 * The team-scoping happens in the Membership collection.
 *
 * Fields:
 *  name        — unique role name (e.g. "Admin", "Manager", "Viewer")
 *  description — explains what this role represents
 *  permissions — array of ObjectId references to Permission documents
 *                (populated via .populate('permissions') in queries)
 *
 * Relationship:
 *  Role → has many Permissions (stored as ObjectId refs)
 *  Role → assigned to Users within Teams via Membership
 */

import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // Array of references to Permission documents
    // Use .populate('permissions') to get full permission objects
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission',
      },
    ],
  },
  { timestamps: true }
);

export const Role = mongoose.model('Role', roleSchema);
