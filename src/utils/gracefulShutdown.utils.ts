import http from 'http';
import { stopAllBackgroundJobs } from '../config/services/queue';
import redisClient from '../config/services/redis';
import prisma from '../config/services/database';

/**
 * Menangani graceful shutdown termasuk penutupan semua koneksi
 */
export const setupGracefulShutdown = (server: http.Server): void => {
  // Tangkap sinyal SIGTERM dan SIGINT
  process.on('SIGTERM', () => handleShutdown(server, 'SIGTERM'));
  process.on('SIGINT', () => handleShutdown(server, 'SIGINT'));

  console.log('✅ Graceful shutdown handler telah disiapkan');
};

/**
 * Menangani proses shutdown
 */
const handleShutdown = async (server: http.Server, signal: string): Promise<void> => {
  console.log(`\n🛑 Menerima sinyal ${signal}, memulai graceful shutdown...`);

  try {
    // Hentikan server HTTP (berhenti menerima permintaan baru)
    server.close(() => {
      console.log('✅ Server HTTP ditutup');
    });

    // Hentikan Bull Queue jobs
    console.log('🔄 Menutup Bull Queue jobs...');
    await stopAllBackgroundJobs();
    console.log('✅ Bull Queue jobs dihentikan');

    // Tutup koneksi Redis
    console.log('🔄 Menutup koneksi Redis...');
    await redisClient.quit();
    console.log('✅ Koneksi Redis ditutup');

    // Tutup koneksi database
    console.log('🔄 Menutup koneksi database...');
    await prisma.$disconnect();
    console.log('✅ Koneksi database ditutup');

    console.log('👋 Proses graceful shutdown selesai');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error selama graceful shutdown:', error);
    process.exit(1);
  }
};
