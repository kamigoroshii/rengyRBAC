import { Permission } from '../models/Permission.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { buildSearchFilter, parsePagination } from '../utils/query.js';

export const createPermission = asyncHandler(async (req, res) => {
  const { code, label, description } = req.body;

  if (!code || !label) {
    throw new AppError('Permission code and label are required', 400);
  }

  const existing = await Permission.findOne({ code: code.toUpperCase() });
  if (existing) {
    throw new AppError('Permission code must be unique', 409);
  }

  const permission = await Permission.create({
    code: code.toUpperCase(),
    label,
    description,
  });

  res.status(201).json(permission);
});

export const getPermissions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildSearchFilter(['code', 'label', 'description'], req.query.search?.trim());

  const [items, total] = await Promise.all([
    Permission.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Permission.countDocuments(filter),
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});
