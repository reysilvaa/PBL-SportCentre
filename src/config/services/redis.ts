import { createClient } from 'redis';
import { config } from '../index';

console.info(`🔄 Mencoba koneksi Redis ke ${config.redis.url}`);

// Redis client instance
const redisClient = createClient({
  url: config.redis.url,
  password: config.redis.password || undefined,
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

// Export the Redis client
export default redisClient;
