const midtransClient = require('midtrans-client');
import dotenv from 'dotenv';

dotenv.config();

const midtrans = new midtransClient.Snap({
  isProduction: process.env.NODE_ENV === 'development',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

export default midtrans;
