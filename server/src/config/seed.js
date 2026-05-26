/**
 * server/src/config/seed.js
 *
 * Database seeding — runs automatically on every server startup.
 *
 * Two exported functions:
 *
 *  ensureDefaultAdmin()
 *    Creates the system admin account from .env credentials if it
 *    doesn't already exist. This is the only way to get an admin account
 *    (self-registration always creates employees).
 *
 *  seedDemoData()
 *    Idempotent — uses findOrCreate so re-running never duplicates data.
 *    Creates:
 *      • 5 permissions  (CREATE_TASK, EDIT_TASK, DELETE_TASK, VIEW_ONLY, MANAGE_MEMBERS)
 *      • 3 roles        (Admin, Manager, Viewer) with permissions assigned
 *      • 3 teams        (Team Alpha, Team Beta, Team Gamma)
 *      • 5 demo users   (alice, bob, carol, dan, eve — all employees)
 *      • 9 memberships  demonstrating cross-team RBAC:
 *          Alice  → Alpha:Admin,   Beta:Viewer
 *          Bob    → Alpha:Manager
 *          Carol  → Beta:Admin,    Gamma:Manager
 *          Dan    → Alpha:Viewer,  Gamma:Viewer
 *          Eve    → Beta:Manager,  Gamma:Admin
 *
 *    Alice is the best demo: same user, Admin in Alpha (4 permissions)
 *    but only Viewer in Beta (1 permission) — proves team-scoped RBAC.
 */

import bcrypt from 'bcryptjs';
import { User }       from '../models/User.js';
import { Team }       from '../models/Team.js';
import { Permission } from '../models/Permission.js';
import { Role }       from '../models/Role.js';
import { Membership } from '../models/Membership.js';

/* ── Helper: hash a password with bcrypt (cost factor 12) ── */
const hash = (pw) => bcrypt.hash(pw, 12);

/**
 * findOrCreate — looks up a document by query.
 * If found, returns it. If not, creates it with the provided data.
 * This makes every seed operation idempotent.
 */
async function findOrCreate(Model, query, data) {
  const existing = await Model.findOne(query);
  return existing || Model.create(data);
}

/* ─────────────────────────────────────────────────────────
   ensureDefaultAdmin
   Creates the admin account from .env on first run.
───────────────────────────────────────────────────────── */
export const ensureDefaultAdmin = async () => {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@rengyrbac.com').toLowerCase();

  return findOrCreate(
    User,
    { email: adminEmail },
    {
      name:         process.env.ADMIN_NAME     || 'System Admin',
      email:        adminEmail,
      passwordHash: await hash(process.env.ADMIN_PASSWORD || 'Admin@12345'),
      accountType:  'admin', // only place in the codebase where admin is created
    }
  );
};

/* ─────────────────────────────────────────────────────────
   seedDemoData
   Populates the database with realistic demo data.
   Safe to call on every restart — never duplicates.
───────────────────────────────────────────────────────── */
export const seedDemoData = async () => {

  /* ── Step 1: Create permissions ──────────────────────── */
  // Permissions are atomic capabilities — stored in their own collection
  // so they can be reused across many roles
  const [pCreate, pEdit, pDelete, pView, pManage] = await Promise.all([
    findOrCreate(Permission, { code: 'CREATE_TASK'    }, { code: 'CREATE_TASK',    label: 'Create Task',    description: 'Allows creating new tasks'         }),
    findOrCreate(Permission, { code: 'EDIT_TASK'      }, { code: 'EDIT_TASK',      label: 'Edit Task',      description: 'Allows editing existing tasks'      }),
    findOrCreate(Permission, { code: 'DELETE_TASK'    }, { code: 'DELETE_TASK',    label: 'Delete Task',    description: 'Allows deleting tasks'              }),
    findOrCreate(Permission, { code: 'VIEW_ONLY'      }, { code: 'VIEW_ONLY',      label: 'View Only',      description: 'Read-only access to team resources' }),
    findOrCreate(Permission, { code: 'MANAGE_MEMBERS' }, { code: 'MANAGE_MEMBERS', label: 'Manage Members', description: 'Add or remove team members'         }),
  ]);

  /* ── Step 2: Create roles and assign permissions ──────── */
  // Roles are reusable across teams — a role is just a named bundle of permissions
  const [roleAdmin, roleManager, roleViewer] = await Promise.all([
    findOrCreate(Role, { name: 'Admin' },   { name: 'Admin',   description: 'Full access',         permissions: [pCreate._id, pEdit._id, pDelete._id, pManage._id] }),
    findOrCreate(Role, { name: 'Manager' }, { name: 'Manager', description: 'Create and edit only', permissions: [pCreate._id, pEdit._id] }),
    findOrCreate(Role, { name: 'Viewer' },  { name: 'Viewer',  description: 'Read-only access',     permissions: [pView._id] }),
  ]);

  // Sync permissions in case roles already existed from a previous run
  await Promise.all([
    Role.findByIdAndUpdate(roleAdmin._id,   { permissions: [pCreate._id, pEdit._id, pDelete._id, pManage._id] }),
    Role.findByIdAndUpdate(roleManager._id, { permissions: [pCreate._id, pEdit._id] }),
    Role.findByIdAndUpdate(roleViewer._id,  { permissions: [pView._id] }),
  ]);

  /* ── Step 3: Create teams ─────────────────────────────── */
  const [teamAlpha, teamBeta, teamGamma] = await Promise.all([
    findOrCreate(Team, { name: 'Team Alpha' }, { name: 'Team Alpha', description: 'Core product engineering team' }),
    findOrCreate(Team, { name: 'Team Beta'  }, { name: 'Team Beta',  description: 'QA and testing team'           }),
    findOrCreate(Team, { name: 'Team Gamma' }, { name: 'Team Gamma', description: 'Design and UX team'            }),
  ]);

  /* ── Step 4: Create demo users ────────────────────────── */
  // All demo users are employees — password from DEFAULT_USER_PASSWORD env var
  const defaultPw = await hash(process.env.DEFAULT_USER_PASSWORD || 'User@12345');

  const [alice, bob, carol, dan, eve] = await Promise.all([
    findOrCreate(User, { email: 'alice@demo.com' }, { name: 'Alice Johnson', email: 'alice@demo.com', passwordHash: defaultPw, accountType: 'employee' }),
    findOrCreate(User, { email: 'bob@demo.com'   }, { name: 'Bob Smith',     email: 'bob@demo.com',   passwordHash: defaultPw, accountType: 'employee' }),
    findOrCreate(User, { email: 'carol@demo.com' }, { name: 'Carol White',   email: 'carol@demo.com', passwordHash: defaultPw, accountType: 'employee' }),
    findOrCreate(User, { email: 'dan@demo.com'   }, { name: 'Dan Brown',     email: 'dan@demo.com',   passwordHash: defaultPw, accountType: 'employee' }),
    findOrCreate(User, { email: 'eve@demo.com'   }, { name: 'Eve Davis',     email: 'eve@demo.com',   passwordHash: defaultPw, accountType: 'employee' }),
  ]);

  /* ── Step 5: Create memberships ───────────────────────── */
  // This is the core of RBAC — a Membership links a User to a Team with specific Roles.
  // The same user can have DIFFERENT roles in different teams.
  // Alice is the best demo: Admin in Alpha, Viewer in Beta → different permissions per team.
  const memberships = [
    { user: alice._id, team: teamAlpha._id, roles: [roleAdmin._id]   },  // Alice: Admin in Alpha
    { user: alice._id, team: teamBeta._id,  roles: [roleViewer._id]  },  // Alice: Viewer in Beta
    { user: bob._id,   team: teamAlpha._id, roles: [roleManager._id] },  // Bob:   Manager in Alpha
    { user: carol._id, team: teamBeta._id,  roles: [roleAdmin._id]   },  // Carol: Admin in Beta
    { user: carol._id, team: teamGamma._id, roles: [roleManager._id] },  // Carol: Manager in Gamma
    { user: dan._id,   team: teamAlpha._id, roles: [roleViewer._id]  },  // Dan:   Viewer in Alpha
    { user: dan._id,   team: teamGamma._id, roles: [roleViewer._id]  },  // Dan:   Viewer in Gamma
    { user: eve._id,   team: teamBeta._id,  roles: [roleManager._id] },  // Eve:   Manager in Beta
    { user: eve._id,   team: teamGamma._id, roles: [roleAdmin._id]   },  // Eve:   Admin in Gamma
  ];

  // Upsert each membership — $set roles so re-runs update rather than duplicate
  await Promise.all(
    memberships.map(({ user, team, roles }) =>
      Membership.findOneAndUpdate(
        { user, team },
        { $set: { roles } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  console.log('[seed] demo data ready — 5 permissions, 3 roles, 3 teams, 5 users, 9 memberships');
};
