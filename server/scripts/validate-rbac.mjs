import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { ensureDefaultAdmin } from '../src/config/seed.js';
import { User } from '../src/models/User.js';
import { Team } from '../src/models/Team.js';
import { Role } from '../src/models/Role.js';
import { Permission } from '../src/models/Permission.js';
import { Membership } from '../src/models/Membership.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const requiredEnv = ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(baseUrl, path, options = {}) {
  const { token, ...fetchOptions } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers || {}),
    },
    ...fetchOptions,
  });

  const body = await response.json().catch(() => ({}));
  assert(response.ok, `${path} failed: ${response.status} ${body.message || response.statusText}`);
  return body;
}

async function main() {
  for (const key of requiredEnv) {
    assert(process.env[key], `Missing required env var: ${key}`);
  }

  await connectDB();
  await ensureDefaultAdmin();

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const createdIds = {
    permissionIds: [],
    roleIds: [],
    teamIds: [],
    userIds: [],
    membershipIds: [],
  };

  try {
    const health = await request(baseUrl, '/health');
    assert(health.status === 'ok', 'Health check failed');

    const adminAuth = await request(baseUrl, '/auth/signin', {
      method: 'POST',
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      }),
    });

    assert(adminAuth.token, 'Admin sign-in did not return a token');

    const signUpEmail = `validator.${Date.now()}@example.com`;
    const signUp = await request(baseUrl, '/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Validator User',
        email: signUpEmail,
        password: 'TempPass@123',
      }),
    });

    createdIds.userIds.push(signUp.user._id);
    const employeeToken = signUp.token;

    const permission = await request(baseUrl, '/permissions', {
      method: 'POST',
      token: adminAuth.token,
      body: JSON.stringify({
        code: 'CREATE_TASK',
        label: 'Create Task',
        description: 'Allows creating tasks',
      }),
    });
    createdIds.permissionIds.push(permission._id);

    const role = await request(baseUrl, '/roles', {
      method: 'POST',
      token: adminAuth.token,
      body: JSON.stringify({
        name: 'Validator Admin',
        description: 'Validation role',
      }),
    });
    createdIds.roleIds.push(role._id);

    await request(baseUrl, `/roles/${role._id}/permissions`, {
      method: 'PUT',
      token: adminAuth.token,
      body: JSON.stringify({ permissionIds: [permission._id] }),
    });

    const team = await request(baseUrl, '/teams', {
      method: 'POST',
      token: adminAuth.token,
      body: JSON.stringify({
        name: `Validator Team ${Date.now()}`,
        description: 'Validation team',
      }),
    });
    createdIds.teamIds.push(team._id);

    const membership = await request(baseUrl, `/teams/${team._id}/members`, {
      method: 'POST',
      token: adminAuth.token,
      body: JSON.stringify({
        userId: signUp.user._id,
        roleIds: [role._id],
      }),
    });
    createdIds.membershipIds.push(membership._id);

    const access = await request(baseUrl, `/teams/${team._id}/users/${signUp.user._id}/permissions`, {
      token: adminAuth.token,
    });

    assert(access.permissions.some((entry) => entry.code === 'CREATE_TASK'), 'Permission resolution failed');

    const users = await request(baseUrl, '/users', { token: adminAuth.token });
    const teams = await request(baseUrl, '/teams', { token: adminAuth.token });
    const roles = await request(baseUrl, '/roles', { token: adminAuth.token });
    const permissions = await request(baseUrl, '/permissions', { token: adminAuth.token });

    assert(users.items.length >= 1, 'Users API returned no data');
    assert(teams.items.length >= 1, 'Teams API returned no data');
    assert(roles.items.length >= 1, 'Roles API returned no data');
    assert(permissions.items.length >= 1, 'Permissions API returned no data');

    const employeeMe = await request(baseUrl, '/auth/me', { token: employeeToken });
    assert(employeeMe.user.email === signUpEmail, 'Employee auth check failed');

    console.log('RBAC validation passed.');
  } finally {
    await Promise.allSettled([
      Membership.deleteMany({ _id: { $in: createdIds.membershipIds } }),
      Team.deleteMany({ _id: { $in: createdIds.teamIds } }),
      Role.deleteMany({ _id: { $in: createdIds.roleIds } }),
      Permission.deleteMany({ _id: { $in: createdIds.permissionIds } }),
      User.deleteMany({ _id: { $in: createdIds.userIds } }),
    ]);

    await mongoose.connection.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});