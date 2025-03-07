import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/env';
import { logger } from './config/logger';
import router from './routes/index.routes';
import { setupSocketServer } from './socket/socketServer';
import { setSocketIo } from './controllers/midtrans.controller';
import errorMiddleware from './middlewares/error.middleware';
import apiDocumentationRoutes from './documentation/api-documentation.routes';

const app: Application = express();
const server: http.Server = http.createServer(app);

// Middleware
app.use(cors({
  origin: '*', // Restrict in production
  credentials: true
}));
app.use(express.json()); // Add JSON parsing
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Root endpoint for API documentation
app.use(apiDocumentationRoutes);

// Routes
app.use('/api', router);

// Error handling middleware
app.use(errorMiddleware as express.ErrorRequestHandler);

// Initialize Socket.IO by passing the HTTP server
const io = setupSocketServer(server);
setSocketIo(io);


// Start server
server.listen(config.port, () => {
  console.log(`Server running on port http://localhost:${config.port}`);
  console.log(`WebSocket server initialized on same port`);
});

export default app;