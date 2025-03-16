import dotenv from 'dotenv';

dotenv.config();

// Type untuk sameSite
type SameSiteOption = boolean | 'none' | 'lax' | 'strict';

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
  urls: {
    api: process.env.NODE_ENV === 'production' 
      ? (process.env.API_URL || 'https://api.sportcenter.id')
      : (process.env.API_URL_DEV || 'http://localhost:3000'),
    frontend: process.env.FRONTEND_URL || 'http://localhost:3001'
  },
  cookies: {
    secret: process.env.COOKIE_SECRET || 'secret-key',
    maxAge: parseInt(process.env.COOKIE_MAX_AGE || '86400000'), // 24 jam default
    httpOnly: true, // tidak dapat diakses oleh JavaScript client-side
    secure: process.env.NODE_ENV === 'production', // hanya HTTPS di production
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as SameSiteOption, // untuk Cross-Site
    domain: process.env.COOKIE_DOMAIN || undefined, // domain cookie
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  cookieSecret: process.env.COOKIE_SECRET || 'secret-key', // untuk middleware cookieParser
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production'
};