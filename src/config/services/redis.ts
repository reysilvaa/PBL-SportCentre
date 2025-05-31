import { createClient, RedisClientType } from 'redis';
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

// Determine if we're using Redis or IoRedis based on URL
const isRedissUrl = config.redis.url.startsWith('rediss://');

// Define types for our Redis clients
type RedisClient = RedisClientType | Redis;
let redisClient: RedisClient;
let isIoRedis = false;

// Use IoRedis for Valkey/Aiven or other TLS Redis services
if (isRedissUrl) {
  console.info('🔒 Menggunakan IoRedis untuk koneksi TLS (rediss://)');
  redisClient = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
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
    enableReadyCheck: true,
    tls: { rejectUnauthorized: false }
  });
  isIoRedis = true;
} else {
  // Use standard Redis client for non-TLS connections
  console.info('🔌 Menggunakan Redis standard untuk koneksi non-TLS (redis://)');
  redisClient = createClient({
    url: config.redis.url,
    password: config.redis.password || undefined,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('Redis: Terlalu banyak percobaan koneksi. Tidak akan mencoba lagi.');
          return new Error('Terlalu banyak percobaan koneksi Redis');
        }
        
        const delay = Math.min(Math.pow(2, retries) * 50, 10000);
        console.log(`Redis: Mencoba koneksi ulang dalam ${delay}ms... (percobaan ke-${retries + 1})`);
        return delay;
      },
      connectTimeout: 10000
    }
  });

  // Connect to Redis (only needed for standard Redis client)
  (redisClient as RedisClientType).connect().catch((err) => {
    console.error('Redis connection error:', err);
    console.error('⚠️ Pastikan server Redis berjalan di ', config.redis.url);
    console.error('⚠️ Nilai ini dibaca dari file .env atau menggunakan default jika tidak ada');
  });
}

// Event handlers
if (isIoRedis) {
  // IoRedis event handlers
  (redisClient as Redis).on('connect', () => {
    console.info('🔌 Redis client connected');
    console.info(`✅ Berhasil terhubung ke Redis di ${config.redis.url}`);
  });

  (redisClient as Redis).on('error', (err) => {
    console.error('🔥 Redis error:', err);
  });

  (redisClient as Redis).on('ready', () => {
    console.info('✅ Redis client ready');
    console.info(`📦 Cache akan kedaluwarsa setelah ${config.redis.ttl} detik`);
  });
} else {
  // Standard Redis client event handlers
  (redisClient as RedisClientType).on('connect', () => {
    console.info('🔌 Redis client connected');
    console.info(`✅ Berhasil terhubung ke Redis di ${config.redis.url}`);
  });

  (redisClient as RedisClientType).on('error', (err) => {
    console.error('🔥 Redis error:', err);
  });

  (redisClient as RedisClientType).on('reconnecting', () => {
    console.warn('⚠️ Redis client reconnecting');
  });

  (redisClient as RedisClientType).on('ready', () => {
    console.info('✅ Redis client ready');
    console.info(`📦 Cache akan kedaluwarsa setelah ${config.redis.ttl} detik`);
  });
}

// Helper function to check if client is connected
const isConnected = (): boolean => {
  if (isIoRedis) {
    return (redisClient as Redis).status === 'ready';
  } else {
    return (redisClient as RedisClientType).isOpen;
  }
};

// Helper function to ensure connection
const ensureConnection = async (): Promise<void> => {
  if (!isConnected()) {
    if (isIoRedis) {
      // IoRedis automatically reconnects
      return;
    } else {
      // Standard Redis client needs explicit reconnect
      await (redisClient as RedisClientType).connect();
    }
  }
};

// Wrapper for Redis operations with connection check
const redisWrapper = {
  exists: async (key: string): Promise<number> => {
    try {
      await ensureConnection();
      if (isIoRedis) {
        return await (redisClient as Redis).exists(key);
      } else {
        return await (redisClient as RedisClientType).exists(key);
      }
    } catch (error) {
      console.error('Redis exists error:', error);
      return 0;
    }
  },
  
  setEx: async (key: string, ttl: number, value: string): Promise<string | null> => {
    try {
      await ensureConnection();
      if (isIoRedis) {
        // IoRedis uses different method signature
        return await (redisClient as Redis).setex(key, ttl, value);
      } else {
        return await (redisClient as RedisClientType).setEx(key, ttl, value);
      }
    } catch (error) {
      console.error('Redis setEx error:', error);
      return null;
    }
  },
  
  del: async (key: string): Promise<number> => {
    try {
      await ensureConnection();
      if (isIoRedis) {
        return await (redisClient as Redis).del(key);
      } else {
        return await (redisClient as RedisClientType).del(key);
      }
    } catch (error) {
      console.error('Redis del error:', error);
      return 0;
    }
  },
  
  get: async (key: string): Promise<string | null> => {
    try {
      await ensureConnection();
      if (isIoRedis) {
        return await (redisClient as Redis).get(key);
      } else {
        return await (redisClient as RedisClientType).get(key);
      }
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  },
  
  set: async (key: string, value: string): Promise<string | null> => {
    try {
      await ensureConnection();
      if (isIoRedis) {
        return await (redisClient as Redis).set(key, value);
      } else {
        return await (redisClient as RedisClientType).set(key, value);
      }
    } catch (error) {
      console.error('Redis set error:', error);
      return null;
    }
  },
  
  keys: async (pattern: string): Promise<string[]> => {
    try {
      await ensureConnection();
      if (isIoRedis) {
        return await (redisClient as Redis).keys(pattern);
      } else {
        return await (redisClient as RedisClientType).keys(pattern);
      }
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  },

  // Additional methods needed by the application
  scan: async (cursor: number, pattern: string, count: number): Promise<{ cursor: number; keys: string[] }> => {
    try {
      await ensureConnection();
      if (isIoRedis) {
        // IoRedis scan returns [cursor, keys]
        const [newCursor, keys] = await (redisClient as Redis).scan(cursor.toString(), 'MATCH', pattern, 'COUNT', count);
        return { cursor: parseInt(newCursor), keys };
      } else {
        // Standard Redis client scan
        const result = await (redisClient as RedisClientType).scan(cursor, {
          MATCH: pattern,
          COUNT: count
        });
        return { cursor: parseInt(result.cursor.toString()), keys: result.keys };
      }
    } catch (error) {
      console.error('Redis scan error:', error);
      return { cursor: 0, keys: [] };
    }
  },

  flushAll: async (): Promise<string> => {
    try {
      await ensureConnection();
      if (isIoRedis) {
        return await (redisClient as Redis).flushall();
      } else {
        return await (redisClient as RedisClientType).flushAll();
      }
    } catch (error) {
      console.error('Redis flushAll error:', error);
      return 'error';
    }
  },

  info: async (section?: string): Promise<Record<string, string>> => {
    try {
      await ensureConnection();
      if (isIoRedis) {
        const info = await (redisClient as Redis).info(section || '');
        // Parse info string into object
        const infoObj: Record<string, string> = {};
        info.split('\r\n').forEach(line => {
          const parts = line.split(':');
          if (parts.length === 2) {
            infoObj[parts[0]] = parts[1];
          }
        });
        return infoObj;
      } else {
        // For standard Redis client, convert string response to object
        const infoStr = await (redisClient as RedisClientType).info(section);
        const infoObj: Record<string, string> = {};
        infoStr.split('\r\n').forEach(line => {
          const parts = line.split(':');
          if (parts.length === 2) {
            infoObj[parts[0]] = parts[1];
          }
        });
        return infoObj;
      }
    } catch (error) {
      console.error('Redis info error:', error);
      return {};
    }
  },

  dbSize: async (): Promise<number> => {
    try {
      await ensureConnection();
      if (isIoRedis) {
        return await (redisClient as Redis).dbsize();
      } else {
        return await (redisClient as RedisClientType).dbSize();
      }
    } catch (error) {
      console.error('Redis dbSize error:', error);
      return 0;
    }
  },

  isConnected: async (): Promise<boolean> => {
    return isConnected();
  }
};

// Export Redis client wrapper
export { redisWrapper as ensureConnection };
export default redisClient;
