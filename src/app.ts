import express, { Application } from 'express';
import {
  config,
  setupHttpCaching,
  initializeApplication,
  startServer,
} from './config';
import router from './routes/index.routes';
import errorMiddleware from './middlewares/error.middleware';
import { setupSwagger } from './config/swagger/swagger.config';
import { setupGracefulShutdown } from './utils/gracefulShutdown.utils';


// Inisialisasi aplikasi Express
const app: Application = express();

// Set base URL untuk respons dari aplikasi
app.set('trust proxy', config.isProduction);
app.locals.baseUrl = config.urls.api;

// Inisialisasi aplikasi dan dapatkan server
const server = initializeApplication(app);

// Setup Swagger dokumentasi
setupSwagger(app);

// Routes dengan HTTP browser caching (header Cache-Control)
app.use('/api', setupHttpCaching(), router);

// Error handling middleware
app.use(errorMiddleware as express.ErrorRequestHandler);

// Setup graceful shutdown
setupGracefulShutdown(server);

// Mulai server
startServer(server);

export default app;
