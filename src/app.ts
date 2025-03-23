import express, { Application } from 'express';
import {
  config,
  setupApiCaching,
  initializeApplication,
  startServer,
} from './config';
import router from './routes/index.routes';
import errorMiddleware from './middlewares/error.middleware';

// Inisialisasi aplikasi Express
const app: Application = express();

// Set base URL untuk respons dari aplikasi
app.set('trust proxy', config.isProduction);
app.locals.baseUrl = config.urls.api;

// Inisialisasi aplikasi dan dapatkan server
const server = initializeApplication(app);

// Routes dengan caching
app.use('/api', setupApiCaching(), router);

// Error handling middleware
app.use(errorMiddleware as express.ErrorRequestHandler);

// Mulai server
startServer(server);

export default app;
