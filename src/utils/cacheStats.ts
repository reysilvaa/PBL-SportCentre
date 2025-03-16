import cache, { getCacheStats } from './cache';

/**
 * Mendapatkan statistik cache
 */
export const getCacheStatistics = () => {
  const stats = getCacheStats();
  const hitRatio = stats.hits + stats.misses > 0 
    ? (stats.hits / (stats.hits + stats.misses)) * 100 
    : 0;
  
  return {
    ...stats,
    hitRatio: hitRatio.toFixed(2) + '%',
    memoryUsage: formatBytes(stats.ksize + stats.vsize)
  };
};

/**
 * Mendapatkan daftar keys dengan pattern tertentu
 */
export const getKeysWithPattern = (pattern: string) => {
  const keys = cache.keys();
  return keys.filter(key => key.includes(pattern));
};

/**
 * Utility function untuk format bytes
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default {
  getCacheStatistics,
  getKeysWithPattern
}; 