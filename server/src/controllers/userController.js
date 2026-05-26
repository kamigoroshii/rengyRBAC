import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { buildSearchFilter, parsePagination } from '../utils/query.js';

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, accountType = 'employee' } = req.body;

  if (!name || !email) {
    throw new AppError('Name and email are required', 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError('Email must be unique', 409);
  }

  const passwordHash = await bcrypt.hash(password || process.env.DEFAULT_USER_PASSWORD || 'User@12345', 12);

  const user = await User.create({
    name,
    email,
    passwordHash,
    accountType: accountType === 'admin' ? 'admin' : 'employee',
  });
  res.status(201).json(user);
});

export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildSearchFilter(['name', 'email'], req.query.search?.trim());

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});
