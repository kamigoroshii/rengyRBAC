import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    accountType: {
      type: String,
      enum: ['admin', 'employee'],
      default: 'employee',
    },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
