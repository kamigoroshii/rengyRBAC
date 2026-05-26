import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../middleware/error.js';
import { getPublicUser, signAuthToken } from '../utils/auth.js';

const sessionResponse = (user, res) => {
  const token = signAuthToken(user);
  res.json({ token, user: getPublicUser(user) });
};

export const signUp = asyncHandler(async (req, res) => {
  const { name, email, password, accountType = 'employee' } = req.body;

  console.log(`[auth] signup attempt: ${email || 'missing-email'}`);

  if (!name || !email || !password) {
    throw new AppError('Name, email, and password are required', 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError('Email must be unique', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    passwordHash,
    accountType: accountType === 'admin' ? 'admin' : 'employee',
  });

  console.log(`[auth] signup success: ${user.email} (${user.accountType})`);

  sessionResponse(user, res);
});

export const signIn = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  console.log(`[auth] signin attempt: ${email || 'missing-email'}`);

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new AppError('Invalid credentials', 401);
  }

  console.log(`[auth] signin success: ${user.email} (${user.accountType})`);

  sessionResponse(user, res);
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({ user: getPublicUser(user) });
});
