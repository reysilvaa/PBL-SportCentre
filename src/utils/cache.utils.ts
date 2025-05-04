import { config } from '../config';
import redisClient from '../config/services/redis';

// Default TTL dari konfigurasi
const DEFAULT_TTL = config.redis.ttl; // dalam detik

/**
 * Get data from cache
 * @param key Cache key
 */
export const getCachedData = async <T>(key: string): Promise<T | undefined> => {
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) as T : undefined;
  } catch (error) {
    console.error('Error getting data from Redis cache:', error);
    return undefined;
  }
};

/**
 * Store data in cache
 * @param key Cache key
 * @param data Data to be stored
 * @param ttl Time-to-live in seconds, defaults to configuration TTL
 */
export const setCachedData = async <T>(
  key: string,
  data: T,
  ttl?: number
): Promise<boolean> => {
  try {
    const serializedData = JSON.stringify(data);
    const expiryTime = ttl || DEFAULT_TTL;
    
    // Set dengan expiry
    await redisClient.setEx(key, expiryTime, serializedData);
    return true;
  } catch (error) {
    console.error('Error setting data in Redis cache:', error);
    return false;
  }
};

/**
 * Delete data from cache
 * @param key Cache key
 */
export const deleteCachedData = async (key: string): Promise<number> => {
  try {
    return await redisClient.del(key);
  } catch (error) {
    console.error('Error deleting data from Redis cache:', error);
    return 0;
  }
};

/**
 * Delete data from cache by pattern
 * @param pattern Pattern of keys to delete
 */
export const deleteCachedDataByPattern = async (pattern: string): Promise<void> => {
  try {
    // SCAN untuk mencari keys dengan pattern
    let cursor = 0;
    const keysToDelete: string[] = [];
    
    do {
      const result = await redisClient.scan(cursor, {
        MATCH: `*${pattern}*`,
        COUNT: 100
      });
      
      cursor = result.cursor;
      if (result.keys.length > 0) {
        keysToDelete.push(...result.keys);
      }
    } while (cursor !== 0);
    
    // Hapus keys yang ditemukan
    if (keysToDelete.length > 0) {
      await redisClient.del(keysToDelete);
    }
  } catch (error) {
    console.error('Error deleting data by pattern from Redis cache:', error);
  }
};

/**
 * Clear entire cache
 */
export const clearCache = async (): Promise<void> => {
  try {
    await redisClient.flushAll();
  } catch (error) {
    console.error('Error clearing Redis cache:', error);
  }
};

/**
 * Middleware function for API caching implementation
 * @param keyPrefix Key prefix for the cache
 * @param ttl Time-to-live in seconds
 */
export const cacheMiddleware = (keyPrefix: string, ttl?: number) => {
  return async (req: any, res: any, next: any) => {
    try {
      // Create key based on method, path, and query params
      const key = `${keyPrefix}:${req.method}:${req.originalUrl}`;

      // Check if data exists in cache
      const cachedData = await getCachedData<any>(key);

      if (cachedData) {
        // If data exists in cache, send response directly using send instead of json
        return res.send(cachedData);
      }

      // Override res.json method to store response in cache
      const originalJson = res.json;
      res.json = async function (data: any) {
        // Check if headers have been sent already
        if (!res.headersSent) {
          // Store data in cache
          await setCachedData(key, data, ttl);
          
          // Return original function
          return originalJson.call(this, data);
        }
        return this;
      };

      // Continue to next middleware
      next();
    } catch (error) {
      console.error('Error in cache middleware:', error);
      next();
    }
  };
};

/**
 * Get cache statistics
 */
export const getCacheStats = async () => {
  try {
    const info = await redisClient.info();
    const infoParsed = info.split('\r\n').reduce((acc: any, line) => {
      const parts = line.split(':');
      if (parts.length === 2) {
        acc[parts[0]] = parts[1];
      }
      return acc;
    }, {});
    
    return {
      keys: await redisClient.dbSize(),
      hits: parseInt(infoParsed.keyspace_hits || '0'),
      misses: parseInt(infoParsed.keyspace_misses || '0'),
      memory: infoParsed.used_memory_human,
      clients: infoParsed.connected_clients,
    };
  } catch (error) {
    console.error('Error getting Redis stats:', error);
    return {
      keys: 0,
      hits: 0,
      misses: 0,
      memory: '0B',
      clients: 0,
    };
  }
};

// Export the Redis client
export default redisClient;
