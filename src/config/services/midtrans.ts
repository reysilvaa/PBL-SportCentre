import { config } from '../app/env';

const midtransClient = require('midtrans-client');

/**
 * Membuat dan mengembalikan instance Midtrans Snap client.
 * Diubah untuk mendukung penggunaan Sandbox mode di production jika FORCE_MIDTRANS_SANDBOX=true.
 *
 * @returns {Object} Instance Midtrans Snap client
 */
export function midtrans() {
  // Jika forceMidtransSandbox diaktifkan, selalu gunakan sandbox
  const useProduction = config.isProduction && !config.forceMidtransSandbox;
  
  console.log(`🔄 Midtrans mode: ${useProduction ? 'Production' : 'Sandbox'}`);
  
  return new midtransClient.Snap({
    isProduction: useProduction,
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
