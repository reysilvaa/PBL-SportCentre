import NodeCache from 'node-cache';

// Creating cache instance
const cache = new NodeCache({
  stdTTL: 300, // default cache time - 5 minutes (in seconds)
  checkperiod: 60, // period to check for expired keys (in seconds)
});

/**
 * Get data from cache
 * @param key Cache key
 */
export const getCachedData = <T>(key: string): T | undefined => {
  return cache.get<T>(key);
};

/**
 * Store data in cache
 * @param key Cache key
 * @param data Data to be stored
 * @param ttl Time-to-live in seconds, defaults to stdTTL from cache configuration
 */
export const setCachedData = <T>(key: string, data: T, ttl?: number): boolean => {
  return ttl !== undefined ? cache.set(key, data, ttl) : cache.set(key, data);
};

/**
 * Delete data from cache
 * @param key Cache key
 */
export const deleteCachedData = (key: string): number => {
  return cache.del(key);
};

/**
 * Delete data from cache by pattern
 * @param pattern Pattern of keys to delete
 */
export const deleteCachedDataByPattern = (pattern: string): void => {
  const keys = cache.keys();
  const keysToDelete = keys.filter(key => key.includes(pattern));
  
  if (keysToDelete.length > 0) {
    cache.del(keysToDelete);
  }
};

/**
 * Clear entire cache
 */
export const clearCache = (): void => {
  cache.flushAll();
};

/**
 * Middleware function for API caching implementation
 * @param keyPrefix Key prefix for the cache
 * @param ttl Time-to-live in seconds
 */
export const cacheMiddleware = (keyPrefix: string, ttl?: number) => {
  return (req: any, res: any, next: any) => {
    try {
      // Create key based on method, path, and query params
      const key = `${keyPrefix}:${req.method}:${req.originalUrl}`;
      
      // Check if data exists in cache
      const cachedData = getCachedData<any>(key);
      
      if (cachedData) {
        // If data exists in cache, send response directly
        return res.json(cachedData);
      }
      
      // Override res.json method to store response in cache
      const originalJson = res.json;
      res.json = function(data: any) {
        // Store data in cache
        if (ttl !== undefined) {
          setCachedData(key, data, ttl);
        } else {
          setCachedData(key, data);
        }
        
        // Return original function
        return originalJson.call(this, data);
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
export const getCacheStats = () => {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    ksize: cache.getStats().ksize,
    vsize: cache.getStats().vsize
  };
};

// Export the cache instance
export default cache;