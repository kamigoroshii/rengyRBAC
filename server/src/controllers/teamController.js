import { Team } from '../models/Team.js';
import { Membership } from '../models/Membership.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { buildSearchFilter, parsePagination } from '../utils/query.js';

export const createTeam = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new AppError('Team name is required', 400);
  }

  const existing = await Team.findOne({ name: name.trim() });
  if (existing) {
    throw new AppError('Team name must be unique', 409);
  }

  const team = await Team.create({ name, description });
  res.status(201).json(team);
});

export const getTeams = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildSearchFilter(['name', 'description'], req.query.search?.trim());

  const [items, total] = await Promise.all([
    Team.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Team.countDocuments(filter),
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const addUserToTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { userId, roleIds = [] } = req.body;

  if (!userId) {
    throw new AppError('userId is required', 400);
  }

  const [user, team] = await Promise.all([
    User.findById(userId),
    Team.findById(teamId),
  ]);

  if (!user || !team) {
    throw new AppError('User or team not found', 404);
  }

  const roles = roleIds.length ? await Role.find({ _id: { $in: roleIds } }) : [];
  const roleObjectIds = roles.map((role) => role._id);

  // Use findOneAndUpdate with upsert — set roles whether creating or updating
  const membership = await Membership.findOneAndUpdate(
    { user: userId, team: teamId },
    { $set: { roles: roleObjectIds } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .populate('user')
    .populate('team')
    .populate({ path: 'roles', populate: { path: 'permissions', model: 'Permission' } });

  res.status(201).json(membership);
});

export const removeUserFromTeam = asyncHandler(async (req, res) => {
  const { teamId, userId } = req.params;
  const result = await Membership.deleteOne({ team: teamId, user: userId });

  if (!result.deletedCount) {
    throw new AppError('Membership not found', 404);
  }

  res.status(204).send();
});

export const updateUserRolesInTeam = asyncHandler(async (req, res) => {
  const { teamId, userId } = req.params;
  const { roleIds = [] } = req.body;

  const membership = await Membership.findOne({ team: teamId, user: userId });
  if (!membership) {
    throw new AppError('Membership not found', 404);
  }

  const roles = roleIds.length ? await Role.find({ _id: { $in: roleIds } }) : [];
  membership.roles = roles.map((role) => role._id);
  await membership.save();

  const updated = await Membership.findById(membership._id)
    .populate('user')
    .populate('team')
    .populate({ path: 'roles', populate: { path: 'permissions', model: 'Permission' } });

  res.json(updated);
});

export const getTeamMembers = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const team = await Team.findById(teamId);

  if (!team) {
    throw new AppError('Team not found', 404);
  }

  const memberships = await Membership.find({ team: teamId })
    .populate('user')
    .populate('team')
    .populate({ path: 'roles', populate: { path: 'permissions', model: 'Permission' } })
    .sort({ createdAt: -1 });

  const items = memberships.map((membership) => {
    const permissions = new Map();

    membership.roles.forEach((role) => {
      role.permissions.forEach((permission) => {
        permissions.set(String(permission._id), permission);
      });
    });

    return {
      id: membership._id,
      user: membership.user,
      team: membership.team,
      roles: membership.roles,
      permissions: Array.from(permissions.values()),
    };
  });

  res.json({ items });
});

export const getUserPermissionsInTeam = asyncHandler(async (req, res) => {
  const { teamId, userId } = req.params;

  const membership = await Membership.findOne({ team: teamId, user: userId })
    .populate('user team')
    .populate({
      path: 'roles',
      populate: {
        path: 'permissions',
        model: 'Permission',
      },
    });

  if (!membership) {
    return res.json({
      user: await User.findById(userId),
      team: await Team.findById(teamId),
      roles: [],
      permissions: [],
    });
  }

  const permissions = new Map();
  membership.roles.forEach((role) => {
    role.permissions.forEach((permission) => permissions.set(String(permission._id), permission));
  });

  res.json({
    user: membership.user,
    team: membership.team,
    roles: membership.roles,
    permissions: Array.from(permissions.values()),
  });
});
