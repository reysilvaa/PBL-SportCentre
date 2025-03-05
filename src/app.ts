import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { config } from './config/env';
import { logger } from './config/logger';
import router from './routes/index.routes';
import { initSocket } from './socket/socketServer';
import errorMiddleware from './middlewares/error.middleware';
import apiDocumentationRoutes from './documentation/api-documentation.routes';

const app: Application = express();

const server: http.Server = http.createServer(app);
const io: Server = new Server(server, { 
  cors: { 
    origin: '*', // Be more specific in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true // Add this for more robust connection
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes recovery
  }
});

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

// Initialize Socket.IO
initSocket(io);

// Start server
server.listen(config.port, () => {
  console.log(`Server running on port http://localhost:${config.port}`);
  console.log(`WebSocket server initialized on same port`);
});

export default app;