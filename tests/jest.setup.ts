import dotenv from 'dotenv';
import { jest, afterEach } from '@jest/globals';

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