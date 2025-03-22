import express, { Application } from 'express';
import http from 'http';
import { config } from './config/env';
import { logger } from './config/logger';
import router from './routes/index.routes';
import { initializeSocketIO } from './config/socket';
import { initializeAllSocketHandlers } from './socket-handlers';
import { startFieldAvailabilityUpdates } from './controllers/all/availability.controller';
import errorMiddleware from './middlewares/error.middleware';
import { setupMiddlewares } from './config/middleware';
import { setupSecurityMiddlewares } from './config/security';

const app: Application = express();
const server: http.Server = http.createServer(app);

// Set base URL untuk respons dari aplikasi
app.set('trust proxy', config.isProduction);
app.locals.baseUrl = config.urls.api;

// Setup security middlewares
setupSecurityMiddlewares(app);

// Setup basic middlewares
setupMiddlewares(app);

// Initialize Socket.IO
initializeSocketIO(server);
initializeAllSocketHandlers();

// Start field availability updates
startFieldAvailabilityUpdates();

// Routes
app.use('/api', router);

// Error handling middleware
app.use(errorMiddleware as express.ErrorRequestHandler);

// Start server
server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log('API URL:', `${config.urls.api}`);
  console.log(`Frontend URL: ${config.urls.frontend}`);
  console.log(`WebSocket server initialized on port ${config.port}`);
  console.log(`Environment: ${config.environment}`);
});

export default app;
