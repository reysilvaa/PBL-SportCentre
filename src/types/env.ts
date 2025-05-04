export interface EnvConfig {
  // Database Configuration
  DATABASE_URL: string;

  // Server Configuration
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: string;
  JWT_SECRET: string;

  // Payment Gateway Configuration (Midtrans)
  MIDTRANS_CLIENT_KEY: string;
  MIDTRANS_SERVER_KEY: string;

  // URL Configuration
  API_URL: string;
  API_URL_DEV: string;
  FRONTEND_URL: string;
  COOKIE_DOMAIN: string;

  // Cache Configuration
  CACHE_TTL: string;
  
  // Redis Configuration
  REDIS_URL: string;
  REDIS_PASSWORD: string;
  REDIS_TTL: string;

  // Cookie Configuration
  COOKIE_SECRET: string;
  COOKIE_MAX_AGE: string;

  // Cloudinary Configuration
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_CLOUD_NAME: string;

  // PASETO Keys
  PASETO_LOCAL_KEY: string;
  PASETO_SECRET_KEY: string;
  PASETO_PUBLIC_KEY: string;
}
