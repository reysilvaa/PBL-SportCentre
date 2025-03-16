// import { config } from '../config/env';

// /**
//  * Membuat URL absolut berdasarkan path relatif
//  * @param path Path relatif (tanpa slash awal)
//  * @returns URL absolut
//  */
// export const getAbsoluteUrl = (path: string): string => {
//   const basePath = config.urls.api;
//   const normalizedPath = path.startsWith('/') ? path : `/${path}`;
//   return `${basePath}${normalizedPath}`;
// };

// /**
//  * Membuat URL API berdasarkan endpoint
//  * @param endpoint Endpoint API (tanpa /api prefix)
//  * @returns URL API lengkap
//  */
// export const getApiUrl = (endpoint: string): string => {
//   const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
//   return getAbsoluteUrl(`/api${normalizedEndpoint}`);
// };

// /**
//  * Mendapatkan URL frontend
//  * @param path Path relatif di frontend (opsional)
//  * @returns URL frontend lengkap
//  */
// export const getFrontendUrl = (path?: string): string => {
//   const basePath = config.urls.frontend;
//   if (!path) return basePath;
  
//   const normalizedPath = path.startsWith('/') ? path : `/${path}`;
//   return `${basePath}${normalizedPath}`;
// };

// /**
//  * Mendeteksi apakah request berasal dari HTTPS
//  * @param req Express request object
//  * @returns Boolean
//  */
// export const isSecure = (req: any): boolean => {
//   // Cek header X-Forwarded-Proto (untuk proxy seperti Nginx, Cloudflare)
//   if (req.headers['x-forwarded-proto']) {
//     return req.headers['x-forwarded-proto'] === 'https';
//   }
//   // Cek properti secure dari request
//   return req.secure || req.protocol === 'https';
// };

// export default {
//   getAbsoluteUrl,
//   getApiUrl,
//   getFrontendUrl,
//   isSecure
// }; 