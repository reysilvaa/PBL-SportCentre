// import { Request, Response, NextFunction } from 'express';

// export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
//   console.log('Request Details:');
//   console.log('Method:', req.method);
//   console.log('Path:', req.path);
//   console.log('Headers:', req.headers);

//   if (req.method !== 'GET') {
//     let rawBody = '';
//     req.on('data', (chunk) => {
//       rawBody += chunk.toString();
//     });

//     req.on('end', () => {
//       try {
//         const parsedBody = rawBody ? JSON.parse(rawBody) : {};
//         console.log('Request Body:', parsedBody);
//       } catch (e) {
//         console.error('Invalid JSON in request body:', e);
//       }
//     });
//   }

//   next();
// };
