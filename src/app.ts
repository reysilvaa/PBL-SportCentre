import express, { Application } from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/env';
import { logger } from './config/logger';
import router from './routes/index.routes';
import { initializeSocketIO } from './config/socket';
import errorMiddleware from './middlewares/error.middleware';

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

// Initialize Socket.IO and store in global.io
initializeSocketIO(server);

// Set up socket handlers from the existing socketServer.ts
// Routes
app.use('/api', router);

// Error handling middleware
app.use(errorMiddleware as express.ErrorRequestHandler);

// Start server
server.listen(config.port, () => {
  console.log(`Server running on port http://localhost:${config.port}`);
  console.log(`WebSocket server initialized on same port`);
});

export default app;