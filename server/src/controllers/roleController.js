import { Role } from '../models/Role.js';
import { Permission } from '../models/Permission.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { buildSearchFilter, parsePagination } from '../utils/query.js';

export const createRole = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new AppError('Role name is required', 400);
  }

  const existing = await Role.findOne({ name: name.trim() });
  if (existing) {
    throw new AppError('Role name must be unique', 409);
  }

  const role = await Role.create({ name, description });
  res.status(201).json(role);
});

export const getRoles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildSearchFilter(['name', 'description'], req.query.search?.trim());

  const [items, total] = await Promise.all([
    Role.find(filter).populate('permissions').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Role.countDocuments(filter),
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const setRolePermissions = asyncHandler(async (req, res) => {
  const { roleId } = req.params;
  const { permissionIds = [] } = req.body;

  const role = await Role.findById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const permissions = permissionIds.length
    ? await Permission.find({ _id: { $in: permissionIds } })
    : [];

  role.permissions = permissions.map((permission) => permission._id);
  await role.save();

  const updated = await Role.findById(role._id).populate('permissions');
  res.json(updated);
});
