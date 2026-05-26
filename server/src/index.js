import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';
import { ensureDefaultAdmin, seedDemoData } from './config/seed.js';

dotenv.config();

const port = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    await ensureDefaultAdmin();
    await seedDemoData();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

start();
