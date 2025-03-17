import NodeCache from 'node-cache';
import { config } from '../../config/env';

// Membuat instance cache yang teroptimasi
const cache = new NodeCache({
  stdTTL: config.cache.ttl, // waktu cache default 5 menit (dalam detik)
  checkperiod: 60, // periode check expired keys (dalam detik)
  useClones: false, // tidak menggunakan clone untuk performa yang lebih baik
  deleteOnExpire: true, // hapus otomatis saat expired
  maxKeys: 10000 // Batasi jumlah key untuk mencegah memory leak
});

/**
 * Mendapatkan data dari cache
 * @param key Key cache
 */
export const getCachedData = <T>(key: string): T | undefined => {
  try {
    return cache.get<T>(key);
  } catch (error) {
    console.error('Error getting data from cache:', error);
    return undefined;
  }
};

/**
 * Menyimpan data ke cache
 * @param key Key cache
 * @param data Data yang akan disimpan
 * @param ttl Time-to-live dalam detik, default menggunakan stdTTL dari konfigurasi cache
 */
export const setCachedData = <T>(key: string, data: T, ttl?: number): boolean => {
  try {
    return ttl !== undefined ? cache.set(key, data, ttl) : cache.set(key, data);
  } catch (error) {
    console.error('Error setting data to cache:', error);
    return false;
  }
};

/**
 * Menghapus data dari cache
 * @param key Key cache
 */
export const deleteCachedData = (key: string): number => {
  try {
    return cache.del(key);
  } catch (error) {
    console.error('Error deleting data from cache:', error);
    return 0;
  }
};

/**
 * Menghapus data dari cache berdasarkan pattern
 * @param pattern Pattern key yang akan dihapus
 */
export const deleteCachedDataByPattern = (pattern: string): void => {
  try {
    const keys = cache.keys();
    const keysToDelete = keys.filter(key => key.includes(pattern));
    
    if (keysToDelete.length > 0) {
      cache.del(keysToDelete);
    }
  } catch (error) {
    console.error('Error deleting data by pattern from cache:', error);
  }
};

/**
 * Membersihkan seluruh cache
 */
export const clearCache = (): void => {
  try {
    cache.flushAll();
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

/**
 * Fungsi middleware untuk implementasi caching pada API
 * @param keyPrefix Key prefix for the cache
 * @param ttl Time-to-live dalam detik
 */
export const cacheMiddleware = (keyPrefix: string, ttl?: number) => {
  return (req: any, res: any, next: any) => {
    try {
      // Buat key berdasarkan method, path, dan query params
      const key = `${keyPrefix}:${req.method}:${req.originalUrl}`;
      
      // Cek apakah data sudah ada di cache
      const cachedData = getCachedData<any>(key);
      
      if (cachedData) {
        // Jika data ada di cache, kirim response langsung
        return res.json(cachedData);
      }
      
      // Override method res.json untuk menyimpan response ke cache
      const originalJson = res.json;
      res.json = function(data: any) {
        // Simpan data ke cache
        if (ttl !== undefined) {
          setCachedData(key, data, ttl);
        } else {
          setCachedData(key, data);
        }
        
        // Kembalikan fungsi asli
        return originalJson.call(this, data);
      };
      
      // Lanjutkan ke middleware berikutnya
      next();
    } catch (error) {
      console.error('Error in cache middleware:', error);
      next();
    }
  };
};

// Metode untuk statistik cache
export const getCacheStats = () => {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    ksize: cache.getStats().ksize,
    vsize: cache.getStats().vsize
  };
};

// Export seluruh cache
export default cache; 