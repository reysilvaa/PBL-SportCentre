const midtransClient = require('midtrans-client');
import dotenv from 'dotenv';

dotenv.config();

const midtrans = new midtransClient.Snap({
  isProduction: false, // Ubah ke true jika di mode produksi
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

export default midtrans;
