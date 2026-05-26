import { Membership } from '../models/Membership.js';

export async function resolveUserPermissionsInTeam(userId, teamId) {
  if (!userId || !teamId) return { roles: [], permissions: [] };

  const membership = await Membership.findOne({ user: userId, team: teamId }).populate({
    path: 'roles',
    populate: { path: 'permissions', model: 'Permission' },
  });

  if (!membership) return { roles: [], permissions: [] };

  const permissions = new Map();
  membership.roles.forEach((role) => {
    role.permissions.forEach((p) => permissions.set(String(p._id), p));
  });

  return {
    roles: membership.roles || [],
    permissions: Array.from(permissions.values()),
  };
}

export async function hasPermission(userId, teamId, code) {
  if (!userId || !teamId || !code) return false;

  const resolved = await resolveUserPermissionsInTeam(userId, teamId);
  return resolved.permissions.some((p) => String(p.code).toUpperCase() === String(code).toUpperCase());
}
