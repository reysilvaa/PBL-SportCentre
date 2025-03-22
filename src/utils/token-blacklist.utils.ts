import NodeCache from 'node-cache';

// Membuat cache khusus untuk token blacklist
const blacklistCache = new NodeCache({
  stdTTL: 24 * 60 * 60, // Default TTL: 24 jam
  checkperiod: 10 * 60, // Periksa expired tokens setiap 10 menit
  useClones: false,
});

/**
 * Menambahkan token ke blacklist
 * @param token Token yang akan di-blacklist
 * @param expiryInSeconds Waktu dalam detik token tetap di blacklist (opsional)
 */
export const blacklistToken = (
  token: string,
  expiryInSeconds?: number,
): void => {
  // Gunakan default TTL jika expiryInSeconds tidak diberikan
  const ttl = expiryInSeconds || 24 * 60 * 60;
  blacklistCache.set(token, true, ttl);
};

/**
 * Memeriksa apakah token ada dalam blacklist
 * @param token Token yang akan diperiksa
 * @returns Boolean
 */
export const isTokenBlacklisted = (token: string): boolean => {
  return blacklistCache.has(token);
};

/**
 * Menghapus token dari blacklist
 * @param token Token yang akan dihapus dari blacklist
 * @returns Boolean
 */
export const removeFromBlacklist = (token: string): boolean => {
  return blacklistCache.del(token) > 0;
};

/**
 * Membersihkan seluruh blacklist
 */
export const clearBlacklist = (): void => {
  blacklistCache.flushAll();
};

/**
 * Mendapatkan jumlah token dalam blacklist
 * @returns number
 */
export const getBlacklistSize = (): number => {
  return blacklistCache.keys().length;
};

/**
 * Menambahkan set token ke blacklist (untuk operasi batch)
 * @param tokens Set token yang akan di-blacklist
 * @param expiryInSeconds Waktu dalam detik token tetap di blacklist (opsional)
 */
export const blacklistTokens = (
  tokens: string[],
  expiryInSeconds?: number,
): void => {
  // Gunakan default TTL jika expiryInSeconds tidak diberikan
  const ttl = expiryInSeconds || 24 * 60 * 60;
  tokens.forEach((token) => {
    blacklistCache.set(token, true, ttl);
  });
};

export default {
  blacklistToken,
  isTokenBlacklisted,
  removeFromBlacklist,
  clearBlacklist,
  getBlacklistSize,
  blacklistTokens,
};
