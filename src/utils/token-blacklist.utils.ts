import { ensureConnection } from '../config/services/redis';

// Prefix untuk kunci blacklist token di Redis
const BLACKLIST_PREFIX = 'token_blacklist:';
const DEFAULT_TTL = 24 * 60 * 60; // Default TTL: 24 jam

/**
 * Menambahkan token ke blacklist
 * @param token Token yang akan di-blacklist
 * @param expiryInSeconds Waktu dalam detik token tetap di blacklist (opsional)
 */
export const blacklistToken = async (token: string, expiryInSeconds?: number): Promise<void> => {
  // Gunakan default TTL jika expiryInSeconds tidak diberikan
  const ttl = expiryInSeconds || DEFAULT_TTL;
  try {
    await ensureConnection.setEx(`${BLACKLIST_PREFIX}${token}`, ttl, '1');
  } catch (error) {
    console.error('Error blacklisting token:', error);
  }
};

/**
 * Memeriksa apakah token ada dalam blacklist
 * @param token Token yang akan diperiksa
 * @returns Boolean
 */
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const exists = await ensureConnection.exists(`${BLACKLIST_PREFIX}${token}`);
    return exists === 1;
  } catch (error) {
    console.error('Error checking blacklisted token:', error);
    return false;
  }
};

/**
 * Menghapus token dari blacklist
 * @param token Token yang akan dihapus dari blacklist
 * @returns Boolean
 */
export const removeFromBlacklist = async (token: string): Promise<boolean> => {
  try {
    const result = await ensureConnection.del(`${BLACKLIST_PREFIX}${token}`);
    return result > 0;
  } catch (error) {
    console.error('Error removing token from blacklist:', error);
    return false;
  }
};

/**
 * Membersihkan seluruh blacklist
 */
export const clearBlacklist = async (): Promise<void> => {
  try {
    // Use keys to get all blacklisted tokens
    const keys = await ensureConnection.keys(`${BLACKLIST_PREFIX}*`);
    
    // Delete each key individually
    for (const key of keys) {
      await ensureConnection.del(key);
    }
  } catch (error) {
    console.error('Error clearing blacklist:', error);
  }
};

/**
 * Mendapatkan jumlah token dalam blacklist
 * @returns number
 */
export const getBlacklistSize = async (): Promise<number> => {
  try {
    // Use keys to get all blacklisted tokens and count them
    const keys = await ensureConnection.keys(`${BLACKLIST_PREFIX}*`);
    return keys.length;
  } catch (error) {
    console.error('Error getting blacklist size:', error);
    return 0;
  }
};

/**
 * Menambahkan set token ke blacklist (untuk operasi batch)
 * @param tokens Set token yang akan di-blacklist
 * @param expiryInSeconds Waktu dalam detik token tetap di blacklist (opsional)
 */
export const blacklistTokens = async (
  tokens: string[],
  expiryInSeconds?: number
): Promise<void> => {
  // Gunakan default TTL jika expiryInSeconds tidak diberikan
  const ttl = expiryInSeconds || DEFAULT_TTL;

  try {
    // Process tokens one by one instead of using pipeline
    for (const token of tokens) {
      await ensureConnection.setEx(`${BLACKLIST_PREFIX}${token}`, ttl, '1');
    }
  } catch (error) {
    console.error('Error blacklisting multiple tokens:', error);
  }
};

export default {
  blacklistToken,
  isTokenBlacklisted,
  removeFromBlacklist,
  clearBlacklist,
  getBlacklistSize,
  blacklistTokens,
};
