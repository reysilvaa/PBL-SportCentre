import Redis from 'ioredis';
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

// Determine if we're using TLS based on URL
const isRedissTLS = config.redis.url.startsWith('rediss://');

// Define types for our Redis client
type RedisClient = Redis;
let redisClient: RedisClient;

// Konfigurasi Redis dengan IoRedis untuk semua jenis koneksi
console.info(`🔒 Menggunakan IoRedis untuk koneksi ${isRedissTLS ? 'TLS (rediss://)' : 'non-TLS (redis://)'}`);
redisClient = new Redis(config.redis.url, {
  maxRetriesPerRequest: null, // Penting untuk kompatibilitas dengan Bull
  retryStrategy: (times) => {
    if (times > 10) {
      console.error('Redis: Terlalu banyak percobaan koneksi. Tidak akan mencoba lagi.');
      return null; // Stop retrying
    }
    const delay = Math.min(Math.pow(2, times) * 50, 10000);
    console.log(`Redis: Mencoba koneksi ulang dalam ${delay}ms... (percobaan ke-${times + 1})`);
    return delay;
  },
  connectTimeout: 10000,
  enableOfflineQueue: false,
  tls: isRedissTLS ? { rejectUnauthorized: false } : undefined
});

// IoRedis event handlers
redisClient.on('connect', () => {
  console.info('🔌 Redis client connected');
  console.info(`✅ Redis terhubung ke ${config.redis.url}`);
});

redisClient.on('error', (err) => {
  console.error('🔥 Redis error:', err);
});

redisClient.on('ready', () => {
  console.info('✅ Redis client ready');
  console.info(`📦 Cache akan kedaluwarsa setelah ${config.redis.ttl} detik`);
});

// Helper function to check if client is connected
const isConnected = (): boolean => {
  return redisClient.status === 'ready';
};

// Helper function to ensure connection
const ensureConnection = async (): Promise<void> => {
  // IoRedis automatically reconnects
  if (!isConnected()) {
    // Tunggu hingga koneksi siap jika belum ready
    return new Promise((resolve) => {
      if (isConnected()) {
        resolve();
      } else {
        redisClient.once('ready', () => {
          resolve();
        });
      }
    });
  }
};

// Wrapper for Redis operations with connection check
const redisWrapper = {
  exists: async (key: string): Promise<number> => {
    try {
      await ensureConnection();
      return await redisClient.exists(key);
    } catch (error) {
      console.error('Redis exists error:', error);
      return 0;
    }
  },
  
  setEx: async (key: string, ttl: number, value: string): Promise<string | null> => {
    try {
      await ensureConnection();
      return await redisClient.setex(key, ttl, value);
    } catch (error) {
      console.error('Redis setEx error:', error);
      return null;
    }
  },
  
  del: async (key: string): Promise<number> => {
    try {
      await ensureConnection();
      return await redisClient.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
      return 0;
    }
  },
  
  get: async (key: string): Promise<string | null> => {
    try {
      await ensureConnection();
      return await redisClient.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  },
  
  set: async (key: string, value: string): Promise<string | null> => {
    try {
      await ensureConnection();
      return await redisClient.set(key, value);
    } catch (error) {
      console.error('Redis set error:', error);
      return null;
    }
  },
  
  keys: async (pattern: string): Promise<string[]> => {
    try {
      await ensureConnection();
      return await redisClient.keys(pattern);
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  },

  // Additional methods needed by the application
  scan: async (cursor: number, pattern: string, count: number): Promise<{ cursor: number; keys: string[] }> => {
    try {
      await ensureConnection();
      // IoRedis scan returns [cursor, keys]
      const [newCursor, keys] = await redisClient.scan(cursor.toString(), 'MATCH', pattern, 'COUNT', count);
      return { cursor: parseInt(newCursor), keys };
    } catch (error) {
      console.error('Redis scan error:', error);
      return { cursor: 0, keys: [] };
    }
  },

  flushAll: async (): Promise<string> => {
    try {
      await ensureConnection();
      return await redisClient.flushall();
    } catch (error) {
      console.error('Redis flushAll error:', error);
      return 'error';
    }
  },

  info: async (section?: string): Promise<Record<string, string>> => {
    try {
      await ensureConnection();
      const info = await redisClient.info(section || '');
      // Parse info string into object
      const infoObj: Record<string, string> = {};
      info.split('\r\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length === 2) {
          infoObj[parts[0]] = parts[1];
        }
      });
      return infoObj;
    } catch (error) {
      console.error('Redis info error:', error);
      return {};
    }
  },

  dbSize: async (): Promise<number> => {
    try {
      await ensureConnection();
      return await redisClient.dbsize();
    } catch (error) {
      console.error('Redis dbSize error:', error);
      return 0;
    }
  },

  isConnected: async (): Promise<boolean> => {
    return isConnected();
  },

  ttl: async (key: string): Promise<number> => {
    try {
      await ensureConnection();
      return await redisClient.ttl(key);
    } catch (error) {
      console.error('Redis ttl error:', error);
      return 0;
    }
  }
};

// Export Redis client wrapper
export { redisWrapper as ensureConnection };
export default redisClient;
