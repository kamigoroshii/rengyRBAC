import jwt from 'jsonwebtoken';

export const signAuthToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      accountType: user.accountType,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const getPublicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  accountType: user.accountType,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
