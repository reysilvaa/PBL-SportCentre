import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET!,
  db: {
    url: process.env.DATABASE_URL!,
  },
  environment: process.env.NODE_ENV || 'development', // Add this line
};