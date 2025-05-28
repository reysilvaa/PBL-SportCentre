import dotenv from 'dotenv';
import { jest, afterEach, afterAll } from '@jest/globals';

// Muat variabel lingkungan dari .env.test jika ada
dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

// Tingkatkan timeout untuk menghindari kegagalan pada pengujian yang membutuhkan waktu lebih lama
jest.setTimeout(30000);

// Matikan output console selama pengujian untuk menjaga output test tetap bersih
// Hapus baris-baris ini jika Anda ingin melihat console.log selama pengujian
if (process.env.SUPPRESS_CONSOLE_OUTPUT === 'true') {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
}

// Reset semua mock setelah setiap test
afterEach(() => {
  jest.clearAllMocks();
});

// Tutup koneksi yang mungkin masih terbuka setelah semua tes selesai
afterAll(async () => {
  // Beri waktu untuk semua operasi async menyelesaikan diri
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Dapatkan referensi ke Redis client yang di-mock
  const mockRedisModule = jest.requireMock('../../src/config/services/redis') as {
    default: {
      quit: () => Promise<void>;
      disconnect: () => Promise<void>;
      isOpen: boolean;
    };
  };
  
  // Pastikan semua koneksi ditutup
  if (mockRedisModule.default && typeof mockRedisModule.default.quit === 'function') {
    await mockRedisModule.default.quit().catch(() => {
      // Ignore errors on quit
    });
  }
  
  // Tunggu sedikit lebih lama untuk memastikan semua koneksi benar-benar tertutup
  await new Promise(resolve => setTimeout(resolve, 100));
}); 