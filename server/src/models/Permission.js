/**
 * server/src/models/Permission.js
 *
 * Mongoose schema for a Permission.
 *
 * A permission is an atomic capability string (e.g. "CREATE_TASK").
 * Permissions are stored in their own collection so they can be
 * reused across many roles without duplication.
 *
 * Fields:
 *  code        — unique uppercase identifier used in code checks
 *                (e.g. requirePermission('CREATE_TASK'))
 *  label       — human-readable name shown in the UI (e.g. "Create Task")
 *  description — explains what this permission allows
 *
 * Data flow:
 *  Permission → assigned to Role → Role assigned to User via Membership
 *  When resolving access: User → Membership → Roles → Permissions
 */

import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true, // always stored as uppercase (CREATE_TASK not create_task)
      unique: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

export const Permission = mongoose.model('Permission', permissionSchema);
