import express, { Application } from 'express';
import { config, initializeApplication, startServer, setupCacheControl } from './config';
import router from './routes/index.routes';
import errorMiddleware from './middlewares/error.middleware';
import { setupSwagger } from './config/swagger/swagger.config';
import { setupGracefulShutdown } from './utils/gracefulShutdown.utils';

// Inisialisasi aplikasi Express
const app: Application = express();

// Set base URL untuk respons dari aplikasi
// Menggunakan konfigurasi trust proxy yang lebih aman
// Opsi yang lebih aman untuk production: proxy count atau array IP yang dipercaya
app.set('trust proxy', config.isProduction ? '1' : false);
app.locals.baseUrl = config.urls.api;

// Inisialisasi aplikasi dan dapatkan server
const server = initializeApplication(app);

// Setup Swagger dokumentasi
setupSwagger(app);

// Routes dengan HTTP browser caching (header Cache-Control)
app.use('/api', setupCacheControl(), router);

// Error handling middleware
app.use(errorMiddleware as express.ErrorRequestHandler);

// Setup graceful shutdown
setupGracefulShutdown(server);

// Mulai server
startServer(server);
