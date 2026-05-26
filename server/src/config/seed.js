import bcrypt from 'bcryptjs';
import { User }       from '../models/User.js';
import { Team }       from '../models/Team.js';
import { Permission } from '../models/Permission.js';
import { Role }       from '../models/Role.js';
import { Membership } from '../models/Membership.js';

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
const hash = (pw) => bcrypt.hash(pw, 12);

async function findOrCreate(Model, query, data) {
  const existing = await Model.findOne(query);
  return existing || Model.create(data);
}

/* ─────────────────────────────────────────────────────────
   1. Admin account (from .env)
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
      accountType:  'admin',
    }
  );
};

/* ─────────────────────────────────────────────────────────
   2. Demo data  (idempotent — safe to run on every restart)
───────────────────────────────────────────────────────── */
export const seedDemoData = async () => {

  /* ── Permissions ── */
  const [pCreate, pEdit, pDelete, pView, pManage] = await Promise.all([
    findOrCreate(Permission, { code: 'CREATE_TASK'    }, { code: 'CREATE_TASK',    label: 'Create Task',      description: 'Allows creating new tasks'          }),
    findOrCreate(Permission, { code: 'EDIT_TASK'      }, { code: 'EDIT_TASK',      label: 'Edit Task',        description: 'Allows editing existing tasks'       }),
    findOrCreate(Permission, { code: 'DELETE_TASK'    }, { code: 'DELETE_TASK',    label: 'Delete Task',      description: 'Allows deleting tasks'               }),
    findOrCreate(Permission, { code: 'VIEW_ONLY'      }, { code: 'VIEW_ONLY',      label: 'View Only',        description: 'Read-only access to team resources'  }),
    findOrCreate(Permission, { code: 'MANAGE_MEMBERS' }, { code: 'MANAGE_MEMBERS', label: 'Manage Members',   description: 'Add or remove team members'          }),
  ]);

  /* ── Roles ── */
  const [roleAdmin, roleManager, roleViewer] = await Promise.all([
    findOrCreate(Role, { name: 'Admin' },   { name: 'Admin',   description: 'Full access — can manage members and all tasks',  permissions: [pCreate._id, pEdit._id, pDelete._id, pManage._id] }),
    findOrCreate(Role, { name: 'Manager' }, { name: 'Manager', description: 'Can create and edit tasks, cannot delete',        permissions: [pCreate._id, pEdit._id] }),
    findOrCreate(Role, { name: 'Viewer' },  { name: 'Viewer',  description: 'Read-only access',                               permissions: [pView._id] }),
  ]);

  // Keep permissions in sync if roles already existed
  await Promise.all([
    Role.findByIdAndUpdate(roleAdmin._id,   { permissions: [pCreate._id, pEdit._id, pDelete._id, pManage._id] }),
    Role.findByIdAndUpdate(roleManager._id, { permissions: [pCreate._id, pEdit._id] }),
    Role.findByIdAndUpdate(roleViewer._id,  { permissions: [pView._id] }),
  ]);

  /* ── Teams ── */
  const [teamAlpha, teamBeta, teamGamma] = await Promise.all([
    findOrCreate(Team, { name: 'Team Alpha' }, { name: 'Team Alpha', description: 'Core product engineering team'   }),
    findOrCreate(Team, { name: 'Team Beta'  }, { name: 'Team Beta',  description: 'QA and testing team'            }),
    findOrCreate(Team, { name: 'Team Gamma' }, { name: 'Team Gamma', description: 'Design and UX team'             }),
  ]);

  /* ── Users ── */
  const defaultPw = await hash(process.env.DEFAULT_USER_PASSWORD || 'User@12345');

  const [alice, bob, carol, dan, eve] = await Promise.all([
    findOrCreate(User, { email: 'alice@demo.com' }, { name: 'Alice Johnson', email: 'alice@demo.com', passwordHash: defaultPw, accountType: 'employee' }),
    findOrCreate(User, { email: 'bob@demo.com'   }, { name: 'Bob Smith',     email: 'bob@demo.com',   passwordHash: defaultPw, accountType: 'employee' }),
    findOrCreate(User, { email: 'carol@demo.com' }, { name: 'Carol White',   email: 'carol@demo.com', passwordHash: defaultPw, accountType: 'employee' }),
    findOrCreate(User, { email: 'dan@demo.com'   }, { name: 'Dan Brown',     email: 'dan@demo.com',   passwordHash: defaultPw, accountType: 'employee' }),
    findOrCreate(User, { email: 'eve@demo.com'   }, { name: 'Eve Davis',     email: 'eve@demo.com',   passwordHash: defaultPw, accountType: 'employee' }),
  ]);

  /* ── Memberships  (upsert so re-runs don't duplicate) ──
     Alice  → Alpha:Admin,  Beta:Viewer
     Bob    → Alpha:Manager
     Carol  → Beta:Admin,   Gamma:Manager
     Dan    → Alpha:Viewer, Gamma:Viewer
     Eve    → Beta:Manager, Gamma:Admin
  ── */
  const memberships = [
    { user: alice._id, team: teamAlpha._id, roles: [roleAdmin._id]              },
    { user: alice._id, team: teamBeta._id,  roles: [roleViewer._id]             },
    { user: bob._id,   team: teamAlpha._id, roles: [roleManager._id]            },
    { user: carol._id, team: teamBeta._id,  roles: [roleAdmin._id]              },
    { user: carol._id, team: teamGamma._id, roles: [roleManager._id]            },
    { user: dan._id,   team: teamAlpha._id, roles: [roleViewer._id]             },
    { user: dan._id,   team: teamGamma._id, roles: [roleViewer._id]             },
    { user: eve._id,   team: teamBeta._id,  roles: [roleManager._id]            },
    { user: eve._id,   team: teamGamma._id, roles: [roleAdmin._id]              },
  ];

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
