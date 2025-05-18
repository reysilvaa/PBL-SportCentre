import { createClient } from 'redis';
import { config } from '../index';

// Namespace dan prefix yang konsisten untuk Redis dan Socket.io
export const NAMESPACE = {
  PREFIX: 'sportcenter',
  FIELDS: 'fields',
  USERS: 'users',
  BRANCHES: 'branches',
  BOOKINGS: 'bookings',
  PAYMENTS: 'payments',
  AUTH: 'auth',
  NOTIFICATION: 'notification',
  CLEANUP: 'cleanup-expired-bookings',
  AVAILABILITY: 'field-availability-updates'
};

export const KEYS = {
  TOKEN_BLACKLIST: `${NAMESPACE.PREFIX}:${NAMESPACE.AUTH}:token_blacklist:`,
  
  SOCKET: {
    ROOT: NAMESPACE.PREFIX,
    FIELDS: `${NAMESPACE.PREFIX}/${NAMESPACE.FIELDS}`,
    NOTIFICATION: `${NAMESPACE.PREFIX}/${NAMESPACE.NOTIFICATION}`
  },
  
  QUEUE: {
    CLEANUP: `${NAMESPACE.PREFIX}:${NAMESPACE.CLEANUP}`,
    AVAILABILITY: `${NAMESPACE.PREFIX}:${NAMESPACE.AVAILABILITY}`
  },
  
  CACHE: {
    FIELD: `${NAMESPACE.PREFIX}:${NAMESPACE.FIELDS}:`,
    BRANCH: `${NAMESPACE.PREFIX}:${NAMESPACE.BRANCHES}:`,
    USER: `${NAMESPACE.PREFIX}:${NAMESPACE.USERS}:`,
    BOOKING: `${NAMESPACE.PREFIX}:${NAMESPACE.BOOKINGS}:`,
    PAYMENT: `${NAMESPACE.PREFIX}:${NAMESPACE.PAYMENTS}:`
  }
};

console.info(`🔄 Mencoba koneksi Redis ke ${config.redis.url}`);

// Redis client instance dengan retry strategy
const redisClient = createClient({
  url: config.redis.url,
  password: config.redis.password || undefined,
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with max retry limit
      if (retries > 20) {
        console.error('Redis: Terlalu banyak percobaan koneksi. Tidak akan mencoba lagi.');
        return new Error('Terlalu banyak percobaan koneksi Redis');
      }
      
      // Exponential backoff: 50ms, 100ms, 200ms, ..., dengan maksimum 10 detik
      const delay = Math.min(Math.pow(2, retries) * 50, 10000);
      console.log(`Redis: Mencoba koneksi ulang dalam ${delay}ms... (percobaan ke-${retries + 1})`);
      return delay;
    }
  }
});

// Connect to Redis
redisClient.connect().catch((err) => {
  console.error('Redis connection error:', err);
  console.error('⚠️ Pastikan server Redis berjalan di ', config.redis.url);
  console.error('⚠️ Nilai ini dibaca dari file .env atau menggunakan default jika tidak ada');
});

// Event handlers
redisClient.on('connect', () => {
  console.info('🔌 Redis client connected');
  console.info(`✅ Berhasil terhubung ke Redis di ${config.redis.url}`);
});

redisClient.on('error', (err) => {
  console.error('🔥 Redis error:', err);
});

redisClient.on('reconnecting', () => {
  console.warn('⚠️ Redis client reconnecting');
});

redisClient.on('ready', () => {
  console.info('✅ Redis client ready');
  console.info(`📦 Cache akan kedaluwarsa setelah ${config.redis.ttl} detik`);
});

// Memastikan Redis client digunakan dengan benar meskipun koneksi sempat terputus
const ensureConnection = {
  exists: async (...args: Parameters<typeof redisClient.exists>) => {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      return await redisClient.exists(...args);
    } catch (error) {
      console.error('Redis exists error:', error);
      return 0;
    }
  },
  
  setEx: async (...args: Parameters<typeof redisClient.setEx>) => {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      return await redisClient.setEx(...args);
    } catch (error) {
      console.error('Redis setEx error:', error);
      return null;
    }
  },
  
  del: async (...args: Parameters<typeof redisClient.del>) => {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      return await redisClient.del(...args);
    } catch (error) {
      console.error('Redis del error:', error);
      return 0;
    }
  },
  
  get: async (...args: Parameters<typeof redisClient.get>) => {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      return await redisClient.get(...args);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  },
  
  set: async (...args: Parameters<typeof redisClient.set>) => {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      return await redisClient.set(...args);
    } catch (error) {
      console.error('Redis set error:', error);
      return null;
    }
  },
  
  keys: async (...args: Parameters<typeof redisClient.keys>) => {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      return await redisClient.keys(...args);
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  }
};

// Export Redis client wrapper
export { ensureConnection };
export default redisClient;
