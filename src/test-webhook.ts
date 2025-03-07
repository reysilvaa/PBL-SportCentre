// test-webhook.ts
import axios from 'axios';

const testWebhook = async () => {
  try {
    const webhookUrl = 'http://localhost:3000/api/midtrans-notification'; // Sesuaikan dengan endpoint Anda
    
    const testPayload = {
      transaction_time: new Date().toISOString(),
      transaction_status: "settlement", // Coba dengan berbagai status: pending, settlement, cancel, dll
      transaction_id: "test-" + Math.floor(Math.random() * 1000000),
      status_message: "midtrans payment notification",
      status_code: "200",
      signature_key: "test-signature-" + Date.now(),
      payment_type: "dana", // Tes berbagai payment_type
      order_id: "PAY-123", // Sesuaikan dengan ID pembayaran yang ada di database Anda
      merchant_id: "G12345678",
      gross_amount: "500000.00", // Sesuaikan dengan jumlah pembayaran yang sesuai
      fraud_status: "accept",
      currency: "IDR"
    };
    
    console.log('Sending test webhook to:', webhookUrl);
    console.log('Payload:', testPayload);
    
    const response = await axios.post(webhookUrl, testPayload, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Response:', response.status, response.data);
  } catch (error) {
    console.error('Error testing webhook:', error);
  }
};

testWebhook();