import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET!,
  midtransServerKey: process.env.MIDTRANS_SERVER_KEY || '',
  midtransClientKey: process.env.MIDTRANS_CLIENT_KEY || '',
  db: {
    url: process.env.DATABASE_URL!,
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '300'), // default TTL 5 menit
  },
  environment: process.env.NODE_ENV || 'development',
};