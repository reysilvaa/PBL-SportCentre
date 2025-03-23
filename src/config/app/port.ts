import { config } from './env';

/**
 * Mendapatkan port yang akan digunakan oleh aplikasi
 * Jika menggunakan PM2, setiap instance akan mendapatkan port yang berbeda
 */
export const getPort = (): number => {
  const basePort = parseInt(config.port.toString(), 10);

  // Jika menggunakan PM2, gunakan port yang berbeda untuk setiap instance
  if (process.env.NODE_APP_INSTANCE) {
    const instanceIndex = parseInt(process.env.NODE_APP_INSTANCE, 10);
    // Gunakan port yang berbeda untuk setiap instance
    // Port akan dimulai dari basePort dan bertambah sesuai index
    return basePort + instanceIndex;
  }

  return basePort;
};

/**
 * Mendapatkan jumlah instance yang berjalan
 */
export const getInstanceCount = (): number => {
  // Jika tidak menggunakan PM2, kembalikan 1
  if (!process.env.NODE_APP_INSTANCE) {
    return 1;
  }

  // Jika menggunakan PM2, kembalikan nomor instance + 1
  return parseInt(process.env.NODE_APP_INSTANCE, 10) + 1;
};
