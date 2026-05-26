/**
 * validate-rbac.mjs
 * Full end-to-end validation of every RBAC feature.
 * Run: npm run validate  (from workspace root)
 *
 * Checks:
 *  1.  Health endpoint
 *  2.  Admin sign-in (JWT)
 *  3.  Employee sign-up (always creates employee, never admin)
 *  4.  /auth/me token verification
 *  5.  Create permission
 *  6.  Get permissions (list + pagination meta)
 *  7.  Create role
 *  8.  Get roles (populated with permissions)
 *  9.  Assign permissions to role
 * 10.  Create team
 * 11.  Get teams (list + pagination meta)
 * 12.  Create user (admin only)
 * 13.  Get users (search works)
 * 14.  Add user to team with role  (membership upsert)
 * 15.  Get team members (populated roles + permissions)
 * 16.  Permission resolution — user has correct permissions in team
 * 17.  Permission resolution — user with NO role has NO permissions
 * 18.  Multiple roles per user in same team
 * 19.  Same user, different roles in different teams (core RBAC requirement)
 * 20.  Update role assignment
 * 21.  Remove user from team
 * 22.  Employee cannot create users (403)
 * 23.  Employee cannot create teams (403)
 * 24.  Employee cannot create roles (403)
 * 25.  Employee cannot create permissions (403)
 * 26.  Unauthenticated request is rejected (401)
 * 27.  Duplicate email rejected (409)
 * 28.  Regex-safe search (special chars don't crash)
 * 29.  Seed data present (demo users, teams, roles, permissions)
 * 30.  Cleanup — all test data removed
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { ensureDefaultAdmin, seedDemoData } from '../src/config/seed.js';
import { User }       from '../src/models/User.js';
import { Team }       from '../src/models/Team.js';
import { Role }       from '../src/models/Role.js';
import { Permission } from '../src/models/Permission.js';
import { Membership } from '../src/models/Membership.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

/* ── Helpers ──────────────────────────────────────────────── */
let passed = 0;
let failed = 0;
const failures = [];

function pass(label) {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label, reason) {
  console.error(`  ✗  ${label}`);
  console.error(`     → ${reason}`);
  failed++;
  failures.push({ label, reason });
}

async function check(label, fn) {
  try {
    await fn();
    pass(label);
  } catch (err) {
    fail(label, err.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let BASE_URL = '';

async function req(path, options = {}) {
  const { token, expectStatus, ...rest } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...rest,
  });
  const body = await res.json().catch(() => ({}));
  if (expectStatus) {
    assert(res.status === expectStatus,
      `Expected HTTP ${expectStatus}, got ${res.status}: ${body.message || JSON.stringify(body)}`);
  } else if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body.message || res.statusText}`);
  }
  return { status: res.status, body };
}

/* ── Cleanup registry ─────────────────────────────────────── */
const cleanup = {
  userIds:       [],
  teamIds:       [],
  roleIds:       [],
  permissionIds: [],
};

/* ── Main ─────────────────────────────────────────────────── */
async function main() {
  /* env check */
  for (const k of ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']) {
    if (!process.env[k]) { console.error(`Missing env var: ${k}`); process.exit(1); }
  }

  console.log('\n━━━  Rengy RBAC — Full Validation  ━━━\n');

  await connectDB();
  await ensureDefaultAdmin();
  await seedDemoData();

  const server = app.listen(0);
  BASE_URL = `http://127.0.0.1:${server.address().port}/api`;
  console.log(`  Server on ${BASE_URL}\n`);

  /* tokens */
  let adminToken = '';
  let empToken   = '';
  let emp2Token  = '';

  /* ids created during tests */
  let permId  = '';
  let perm2Id = '';
  let roleId  = '';
  let role2Id = '';
  let teamId  = '';
  let team2Id = '';
  let userId  = '';
  let user2Id = '';

  const ts = Date.now();

  /* ── Section 1: Auth ──────────────────────────────────── */
  console.log('── Auth ──────────────────────────────────────────────');

  await check('Health endpoint returns ok', async () => {
    const { body } = await req('/health');
    assert(body.status === 'ok', `Expected status ok, got ${body.status}`);
  });

  await check('Admin sign-in returns JWT', async () => {
    const { body } = await req('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
    });
    assert(body.token, 'No token returned');
    assert(body.user.accountType === 'admin', 'Admin account type wrong');
    adminToken = body.token;
  });

  await check('Employee sign-up returns JWT', async () => {
    const { body } = await req('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'Val User One', email: `val1.${ts}@test.com`, password: 'Test@1234' }),
    });
    assert(body.token, 'No token returned');
    assert(body.user.accountType === 'employee', 'Sign-up should always create employee');
    empToken = body.token;
    userId   = body.user._id;
    cleanup.userIds.push(userId);
  });

  await check('Sign-up cannot self-promote to admin', async () => {
    const { body } = await req('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name: 'Val User Two', email: `val2.${ts}@test.com`, password: 'Test@1234', accountType: 'admin' }),
    });
    assert(body.user.accountType === 'employee', 'accountType should be forced to employee');
    emp2Token = body.token;
    user2Id   = body.user._id;
    cleanup.userIds.push(user2Id);
  });

  await check('/auth/me returns correct user', async () => {
    const { body } = await req('/auth/me', { token: empToken });
    assert(body.user.email === `val1.${ts}@test.com`, 'Wrong user returned');
  });

  await check('Unauthenticated request rejected with 401', async () => {
    await req('/users', { expectStatus: 401 });
  });

  await check('Duplicate email rejected with 409', async () => {
    await req('/auth/signup', {
      method: 'POST',
      expectStatus: 409,
      body: JSON.stringify({ name: 'Dup', email: `val1.${ts}@test.com`, password: 'Test@1234' }),
    });
  });

  /* ── Section 2: Permissions ───────────────────────────── */
  console.log('\n── Permissions ───────────────────────────────────────');

  await check('Admin can create permission', async () => {
    const { body } = await req('/permissions', {
      method: 'POST', token: adminToken,
      body: JSON.stringify({ code: `VAL_PERM_${ts}`, label: 'Val Perm', description: 'Validation permission' }),
    });
    assert(body.code === `VAL_PERM_${ts}`, 'Wrong code returned');
    permId = body._id;
    cleanup.permissionIds.push(permId);
  });

  await check('Admin can create second permission', async () => {
    const { body } = await req('/permissions', {
      method: 'POST', token: adminToken,
      body: JSON.stringify({ code: `VAL_PERM2_${ts}`, label: 'Val Perm 2', description: 'Second validation permission' }),
    });
    perm2Id = body._id;
    cleanup.permissionIds.push(perm2Id);
  });

  await check('Get permissions returns list with pagination', async () => {
    const { body } = await req('/permissions', { token: adminToken });
    assert(Array.isArray(body.items), 'items should be array');
    assert(typeof body.total === 'number', 'total should be number');
    assert(typeof body.pages === 'number', 'pages should be number');
    assert(body.items.length >= 1, 'Should have at least 1 permission');
  });

  await check('Employee cannot create permission (403)', async () => {
    await req('/permissions', {
      method: 'POST', token: empToken, expectStatus: 403,
      body: JSON.stringify({ code: 'FORBIDDEN_PERM', label: 'x' }),
    });
  });

  await check('Duplicate permission code rejected (409)', async () => {
    await req('/permissions', {
      method: 'POST', token: adminToken, expectStatus: 409,
      body: JSON.stringify({ code: `VAL_PERM_${ts}`, label: 'Dup' }),
    });
  });

  await check('Search with special regex chars does not crash', async () => {
    const { body } = await req('/permissions?search=' + encodeURIComponent('(test[*'), { token: adminToken });
    assert(Array.isArray(body.items), 'Should return items array even for special chars');
  });

  /* ── Section 3: Roles ─────────────────────────────────── */
  console.log('\n── Roles ─────────────────────────────────────────────');

  await check('Admin can create role', async () => {
    const { body } = await req('/roles', {
      method: 'POST', token: adminToken,
      body: JSON.stringify({ name: `ValRole_${ts}`, description: 'Validation role' }),
    });
    assert(body.name === `ValRole_${ts}`, 'Wrong name returned');
    roleId = body._id;
    cleanup.roleIds.push(roleId);
  });

  await check('Admin can create second role', async () => {
    const { body } = await req('/roles', {
      method: 'POST', token: adminToken,
      body: JSON.stringify({ name: `ValRole2_${ts}`, description: 'Second validation role' }),
    });
    role2Id = body._id;
    cleanup.roleIds.push(role2Id);
  });

  await check('Assign permissions to role', async () => {
    const { body } = await req(`/roles/${roleId}/permissions`, {
      method: 'PUT', token: adminToken,
      body: JSON.stringify({ permissionIds: [permId] }),
    });
    assert(body.permissions.some(p => p._id === permId), 'Permission not assigned to role');
  });

  await check('Assign permissions to second role', async () => {
    const { body } = await req(`/roles/${role2Id}/permissions`, {
      method: 'PUT', token: adminToken,
      body: JSON.stringify({ permissionIds: [perm2Id] }),
    });
    assert(body.permissions.some(p => p._id === perm2Id), 'Permission not assigned to role2');
  });

  await check('Get roles returns populated permissions', async () => {
    const { body } = await req('/roles', { token: adminToken });
    assert(Array.isArray(body.items), 'items should be array');
    const found = body.items.find(r => r._id === roleId);
    assert(found, 'Created role not in list');
    assert(Array.isArray(found.permissions), 'permissions should be array');
    assert(found.permissions.some(p => p._id === permId), 'Permission not populated in role');
  });

  await check('Employee cannot create role (403)', async () => {
    await req('/roles', {
      method: 'POST', token: empToken, expectStatus: 403,
      body: JSON.stringify({ name: 'ForbiddenRole' }),
    });
  });

  /* ── Section 4: Teams ─────────────────────────────────── */
  console.log('\n── Teams ─────────────────────────────────────────────');

  await check('Admin can create team', async () => {
    const { body } = await req('/teams', {
      method: 'POST', token: adminToken,
      body: JSON.stringify({ name: `ValTeam_${ts}`, description: 'Validation team' }),
    });
    assert(body.name === `ValTeam_${ts}`, 'Wrong name returned');
    teamId = body._id;
    cleanup.teamIds.push(teamId);
  });

  await check('Admin can create second team', async () => {
    const { body } = await req('/teams', {
      method: 'POST', token: adminToken,
      body: JSON.stringify({ name: `ValTeam2_${ts}`, description: 'Second validation team' }),
    });
    team2Id = body._id;
    cleanup.teamIds.push(team2Id);
  });

  await check('Get teams returns list with pagination', async () => {
    const { body } = await req('/teams', { token: adminToken });
    assert(Array.isArray(body.items), 'items should be array');
    assert(typeof body.total === 'number', 'total should be number');
    assert(body.items.some(t => t._id === teamId), 'Created team not in list');
  });

  await check('Employee cannot create team (403)', async () => {
    await req('/teams', {
      method: 'POST', token: empToken, expectStatus: 403,
      body: JSON.stringify({ name: 'ForbiddenTeam' }),
    });
  });

  /* ── Section 5: Users ─────────────────────────────────── */
  console.log('\n── Users ─────────────────────────────────────────────');

  await check('Get users returns list with pagination', async () => {
    const { body } = await req('/users', { token: adminToken });
    assert(Array.isArray(body.items), 'items should be array');
    assert(typeof body.total === 'number', 'total should be number');
    assert(body.items.length >= 1, 'Should have at least 1 user');
  });

  await check('Search users by name works', async () => {
    const { body } = await req('/users?search=Val+User+One', { token: adminToken });
    assert(body.items.some(u => u.email === `val1.${ts}@test.com`), 'Search did not find user');
  });

  await check('Employee cannot create user (403)', async () => {
    await req('/users', {
      method: 'POST', token: empToken, expectStatus: 403,
      body: JSON.stringify({ name: 'Forbidden', email: 'forbidden@test.com', password: 'x' }),
    });
  });

  /* ── Section 6: Memberships ───────────────────────────── */
  console.log('\n── Memberships ───────────────────────────────────────');

  await check('Add user to team with role', async () => {
    const { body } = await req(`/teams/${teamId}/members`, {
      method: 'POST', token: adminToken,
      body: JSON.stringify({ userId, roleIds: [roleId] }),
    });
    assert(body.user._id === userId || body.user === userId, 'Wrong user in membership');
    assert(body.roles.some(r => r._id === roleId || r === roleId), 'Role not in membership');
  });

  await check('Get team members returns populated data', async () => {
    const { body } = await req(`/teams/${teamId}/members`, { token: adminToken });
    assert(Array.isArray(body.items), 'items should be array');
    const member = body.items.find(m => m.user._id === userId);
    assert(member, 'User not found in team members');
    assert(member.roles.some(r => r._id === roleId), 'Role not populated in member');
    assert(member.permissions.some(p => p._id === permId), 'Permission not resolved in member');
  });

  await check('Upsert membership (add same user again updates roles)', async () => {
    const { body } = await req(`/teams/${teamId}/members`, {
      method: 'POST', token: adminToken,
      body: JSON.stringify({ userId, roleIds: [roleId, role2Id] }),
    });
    assert(body.roles.length === 2, `Expected 2 roles, got ${body.roles.length}`);
  });

  /* ── Section 7: Permission Resolution (core RBAC) ──────── */
  console.log('\n── Permission Resolution (core RBAC) ────────────────');

  await check('User has correct permissions in team', async () => {
    const { body } = await req(`/teams/${teamId}/users/${userId}/permissions`, { token: adminToken });
    assert(Array.isArray(body.permissions), 'permissions should be array');
    assert(body.permissions.some(p => p._id === permId),  'perm1 not resolved');
    assert(body.permissions.some(p => p._id === perm2Id), 'perm2 not resolved (from role2)');
    assert(body.roles.length === 2, `Expected 2 roles, got ${body.roles.length}`);
  });

  await check('User with NO role in team has NO permissions', async () => {
    const { body } = await req(`/teams/${team2Id}/users/${userId}/permissions`, { token: adminToken });
    assert(body.permissions.length === 0, `Expected 0 permissions, got ${body.permissions.length}`);
    assert(body.roles.length === 0, `Expected 0 roles, got ${body.roles.length}`);
  });

  await check('CORE: Same user, different roles in different teams', async () => {
    // Add user2 to team1 with role1, team2 with role2
    await req(`/teams/${teamId}/members`, {
      method: 'POST', token: adminToken,
      body: JSON.stringify({ userId: user2Id, roleIds: [roleId] }),
    });
    await req(`/teams/${team2Id}/members`, {
      method: 'POST', token: adminToken,
      body: JSON.stringify({ userId: user2Id, roleIds: [role2Id] }),
    });

    const team1Access = await req(`/teams/${teamId}/users/${user2Id}/permissions`, { token: adminToken });
    const team2Access = await req(`/teams/${team2Id}/users/${user2Id}/permissions`, { token: adminToken });

    assert(team1Access.body.permissions.some(p => p._id === permId),   'user2 should have perm1 in team1');
    assert(!team1Access.body.permissions.some(p => p._id === perm2Id), 'user2 should NOT have perm2 in team1');
    assert(team2Access.body.permissions.some(p => p._id === perm2Id),  'user2 should have perm2 in team2');
    assert(!team2Access.body.permissions.some(p => p._id === permId),  'user2 should NOT have perm1 in team2');
  });

  await check('Update role assignment changes permissions', async () => {
    // Remove role2 from user in team1 — should lose perm2
    await req(`/teams/${teamId}/members/${userId}/roles`, {
      method: 'PUT', token: adminToken,
      body: JSON.stringify({ roleIds: [roleId] }),
    });
    const { body } = await req(`/teams/${teamId}/users/${userId}/permissions`, { token: adminToken });
    assert(body.permissions.some(p => p._id === permId),   'Should still have perm1');
    assert(!body.permissions.some(p => p._id === perm2Id), 'Should no longer have perm2 after role update');
  });

  await check('Remove user from team removes all permissions', async () => {
    await req(`/teams/${teamId}/members/${userId}`, {
      method: 'DELETE', token: adminToken,
    });
    const { body } = await req(`/teams/${teamId}/users/${userId}/permissions`, { token: adminToken });
    assert(body.permissions.length === 0, 'Should have 0 permissions after removal');
    assert(body.roles.length === 0, 'Should have 0 roles after removal');
  });

  /* ── Section 8: Seed data ─────────────────────────────── */
  console.log('\n── Seed data ─────────────────────────────────────────');

  await check('Demo users exist (Alice, Bob, Carol, Dan, Eve)', async () => {
    const { body } = await req('/users', { token: adminToken });
    const emails = body.items.map(u => u.email);
    for (const e of ['alice@demo.com','bob@demo.com','carol@demo.com','dan@demo.com','eve@demo.com']) {
      assert(emails.includes(e), `Demo user ${e} not found`);
    }
  });

  await check('Demo teams exist (Alpha, Beta, Gamma)', async () => {
    const { body } = await req('/teams', { token: adminToken });
    const names = body.items.map(t => t.name);
    for (const n of ['Team Alpha','Team Beta','Team Gamma']) {
      assert(names.includes(n), `Demo team ${n} not found`);
    }
  });

  await check('Demo roles exist (Admin, Manager, Viewer)', async () => {
    const { body } = await req('/roles', { token: adminToken });
    const names = body.items.map(r => r.name);
    for (const n of ['Admin','Manager','Viewer']) {
      assert(names.includes(n), `Demo role ${n} not found`);
    }
  });

  await check('Demo permissions exist (CREATE_TASK, EDIT_TASK, DELETE_TASK, VIEW_ONLY)', async () => {
    const { body } = await req('/permissions', { token: adminToken });
    const codes = body.items.map(p => p.code);
    for (const c of ['CREATE_TASK','EDIT_TASK','DELETE_TASK','VIEW_ONLY','MANAGE_MEMBERS']) {
      assert(codes.includes(c), `Demo permission ${c} not found`);
    }
  });

  await check('Alice has Admin in Team Alpha, Viewer in Team Beta (demo RBAC)', async () => {
    const { body: usersBody } = await req('/users?search=alice', { token: adminToken });
    const alice = usersBody.items.find(u => u.email === 'alice@demo.com');
    assert(alice, 'Alice not found');

    const { body: teamsBody } = await req('/teams', { token: adminToken });
    const alpha = teamsBody.items.find(t => t.name === 'Team Alpha');
    const beta  = teamsBody.items.find(t => t.name === 'Team Beta');
    assert(alpha && beta, 'Team Alpha or Beta not found');

    const alphaAccess = await req(`/teams/${alpha._id}/users/${alice._id}/permissions`, { token: adminToken });
    const betaAccess  = await req(`/teams/${beta._id}/users/${alice._id}/permissions`,  { token: adminToken });

    assert(alphaAccess.body.roles.some(r => r.name === 'Admin'),  'Alice should be Admin in Team Alpha');
    assert(betaAccess.body.roles.some(r => r.name === 'Viewer'),  'Alice should be Viewer in Team Beta');
    assert(alphaAccess.body.permissions.some(p => p.code === 'CREATE_TASK'), 'Alice should have CREATE_TASK in Alpha');
    assert(betaAccess.body.permissions.some(p => p.code === 'VIEW_ONLY'),   'Alice should have VIEW_ONLY in Beta');
    assert(!betaAccess.body.permissions.some(p => p.code === 'CREATE_TASK'),'Alice should NOT have CREATE_TASK in Beta');
  });

  /* ── Results ──────────────────────────────────────────── */
  console.log('\n━━━  Results  ━━━');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);

  if (failures.length) {
    console.log('\n  Failures:');
    failures.forEach(f => console.log(`  ✗ ${f.label}\n    ${f.reason}`));
  } else {
    console.log('\n  All checks passed ✓');
  }

  /* ── Cleanup ──────────────────────────────────────────── */
  await Promise.allSettled([
    Membership.deleteMany({ team: { $in: cleanup.teamIds } }),
    Team.deleteMany({ _id: { $in: cleanup.teamIds } }),
    Role.deleteMany({ _id: { $in: cleanup.roleIds } }),
    Permission.deleteMany({ _id: { $in: cleanup.permissionIds } }),
    User.deleteMany({ _id: { $in: cleanup.userIds } }),
  ]);

  await mongoose.connection.close().catch(() => {});
  await new Promise(resolve => server.close(resolve));

  if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exitCode = 1;
});
