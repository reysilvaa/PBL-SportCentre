import redisClient from '../config/services/redis';

// Waktu TTL default yang lebih rendah untuk responsivitas
const DEFAULT_TTL = 30; // 30 detik (lebih responsif)

/**
 * Get data from cache
 * @param key Cache key
 */
export const getCachedData = async <T>(key: string): Promise<T | undefined> => {
  try {
    // Periksa koneksi Redis sebelum akses
    if (!redisClient.isOpen) {
      console.warn('[CACHE] Redis connection not open, skipping cache get');
      return undefined;
    }
    
    const data = await redisClient.get(key);
    console.log(`[CACHE] Get: ${key} - ${data ? 'HIT' : 'MISS'}`);
    return data ? JSON.parse(data) as T : undefined;
  } catch (error) {
    console.error('[CACHE ERROR] Error getting data from Redis cache:', error);
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
    // Periksa koneksi Redis sebelum akses
    if (!redisClient.isOpen) {
      console.warn('[CACHE] Redis connection not open, skipping cache set');
      return false;
    }
    
    const serializedData = JSON.stringify(data);
    const expiryTime = ttl || DEFAULT_TTL;
    
    // Set dengan expiry
    await redisClient.setEx(key, expiryTime, serializedData);
    console.log(`[CACHE] Set: ${key} - TTL: ${expiryTime}s`);
    return true;
  } catch (error) {
    console.error('[CACHE ERROR] Error setting data in Redis cache:', error);
    return false;
  }
};

/**
 * Delete data from cache
 * @param key Cache key
 */
export const deleteCachedData = async (key: string): Promise<number> => {
  try {
    // Periksa koneksi Redis sebelum akses
    if (!redisClient.isOpen) {
      console.warn('[CACHE] Redis connection not open, skipping cache delete');
      return 0;
    }
    
    const result = await redisClient.del(key);
    console.log(`[CACHE] Delete: ${key} - Result: ${result}`);
    return result;
  } catch (error) {
    console.error('[CACHE ERROR] Error deleting data from Redis cache:', error);
    return 0;
  }
};

/**
 * Delete data from cache by pattern - optimized version
 * @param pattern Pattern of keys to delete
 * @param verbose Whether to log detailed information
 */
export const deleteCachedDataByPattern = async (pattern: string, verbose: boolean = false): Promise<number> => {
  try {
    // Periksa koneksi Redis sebelum akses
    if (!redisClient.isOpen) {
      console.warn('[CACHE] Redis connection not open, skipping cache delete by pattern');
      return 0;
    }
    
    // Jika tidak ada pattern, gunakan wildcard untuk mencocokkan semua key
    const actualPattern = pattern === '' ? '*' : `*${pattern}*`;
    
    let cursor = 0;
    const keysToDelete: string[] = [];
    
    // Scan dengan satu pattern saja untuk mengurangi operasi
    do {
      const result = await redisClient.scan(cursor, {
        MATCH: actualPattern,
        COUNT: 100
      });
      
      cursor = result.cursor;
      if (result.keys.length > 0) {
        keysToDelete.push(...result.keys);
      }
    } while (cursor !== 0);
    
    // Hapus keys yang ditemukan (tanpa duplikat)
    const uniqueKeys = [...new Set(keysToDelete)];
    let deletedCount = 0;
    
    if (uniqueKeys.length > 0) {
      deletedCount = await redisClient.del(uniqueKeys);
      if (verbose) {
        console.log(`[CACHE] Delete by pattern: ${pattern} - Deleted ${deletedCount} keys`);
        console.log(`[CACHE] Deleted keys:`, uniqueKeys);
      } else {
        console.log(`[CACHE] Delete by pattern: ${pattern} - Deleted ${deletedCount} keys`);
      }
    } else if (verbose) {
      console.log(`[CACHE] No keys found for pattern: ${pattern}`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('[CACHE ERROR] Error deleting data by pattern from Redis cache:', error);
    return 0;
  }
};

/**
 * Clear entire cache
 */
export const clearCache = async (): Promise<void> => {
  try {
    // Periksa koneksi Redis sebelum akses
    if (!redisClient.isOpen) {
      console.warn('[CACHE] Redis connection not open, skipping clear cache');
      return;
    }
    
    await redisClient.flushAll();
    console.log(`[CACHE] Clear all cache`);
  } catch (error) {
    console.error('[CACHE ERROR] Error clearing Redis cache:', error);
  }
};

/**
 * Middleware function for API caching implementation with improved invalidation
 * @param keyPrefix Key prefix for the cache
 * @param ttl Time-to-live in seconds
 */
export const cacheMiddleware = (keyPrefix: string, ttl?: number) => {
  // Gunakan TTL yang lebih rendah untuk semua endpoint
  const cacheTTL = ttl || DEFAULT_TTL; // Default 30 detik jika tidak diatur
  
  return async (req: any, res: any, next: any) => {
    try {
      // Skip cache completely if DISABLE_CACHE query param exists
      if (req.query.noCache === 'true' || req.query.refresh === 'true') {
        console.log(`[CACHE] Cache disabled via query param for: ${req.originalUrl}`);
        return next();
      }
      
      // Skip cache untuk metode mutasi (POST, PUT, DELETE, PATCH)
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        console.log(`[CACHE] Skipping cache for mutating method: ${req.method}`);
        return next();
      }
      
      // Tambahkan timestamp ke key cache untuk mendukung versioning
      const timestamp = Math.floor(Date.now() / (cacheTTL * 1000)); // Versi cache berdasarkan TTL
      const key = `${keyPrefix}:${req.method}:${req.originalUrl}:v${timestamp}`;

      // Periksa koneksi Redis sebelum akses
      if (!redisClient.isOpen) {
        console.warn('[CACHE] Redis connection not open, skipping cache middleware');
        return next();
      }

      // Check if data exists in cache
      const cachedData = await getCachedData<any>(key);

      if (cachedData) {
        // Log hit ratio untuk monitoring
        console.log(`[CACHE] Serving from cache: ${key}`);
        
        // Add cache header for transparency
        res.set('X-Cache', 'HIT');
        return res.send(cachedData);
      }
      
      // Add cache header for transparency
      res.set('X-Cache', 'MISS');

      // Override res.json method to store response in cache
      const originalJson = res.json;
      res.json = async function (data: any) {
        // Check if headers have been sent already
        if (!res.headersSent) {
          // Only cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Store data in cache
            await setCachedData(key, data, cacheTTL);
            console.log(`[CACHE] Storing in cache: ${key}`);
          }
          
          // Return original function
          return originalJson.call(this, data);
        }
        return this;
      };

      // Continue to next middleware
      next();
    } catch (error) {
      console.error('[CACHE ERROR] Error in cache middleware:', error);
      // Continue without caching on error
      next();
    }
  };
};

/**
 * Get cache statistics
 */
export const getCacheStats = async () => {
  try {
    // Periksa koneksi Redis sebelum akses
    if (!redisClient.isOpen) {
      console.warn('[CACHE] Redis connection not open, skipping get cache stats');
      return {
        keys: 0,
        hits: 0,
        misses: 0,
        memory: '0B',
        clients: 0,
        connected: false
      };
    }
    
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
      connected: true
    };
  } catch (error) {
    console.error('[CACHE ERROR] Error getting Redis stats:', error);
    return {
      keys: 0,
      hits: 0,
      misses: 0,
      memory: '0B',
      clients: 0,
      connected: false
    };
  }
};

// Export the Redis client
export default redisClient;
