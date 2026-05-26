import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

export const ensureDefaultAdmin = async () => {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@rengyrbac.com').toLowerCase();
  const existing = await User.findOne({ email: adminEmail });

  if (existing) {
    return existing;
  }

  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 12);
  return User.create({
    name: process.env.ADMIN_NAME || 'System Admin',
    email: adminEmail,
    passwordHash,
    accountType: 'admin',
  });
};
