import { config } from '../app/env';

const midtransClient = require('midtrans-client');

/**
 * Membuat dan mengembalikan instance Midtrans Snap client.
 *
 * @returns {Object} Instance Midtrans Snap client
 */
export function midtrans() {
  return new midtransClient.Snap({
    isProduction: config.isProduction,
    serverKey: config.midtransServerKey,
    clientKey: config.midtransClientKey,
    // API options
    apiConfig: {
      timeout: 5000, // 5 detik timeout
    },
  });
}

// Export default dari fungsi midtrans
export default midtrans;
