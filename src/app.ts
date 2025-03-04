import express, { Application } from 'express';
import multer from 'multer';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { config } from './config/env';
import { logger } from './config/logger';
import router from './routes/index.routes';
import { initSocket } from './socket/socketServer';
import { errorMiddleware } from './middlewares/errorMiddleware';
import apiDocumentationRoutes from './documentation/api-documentation.routes';

const app: Application = express();
const upload = multer(); 
const server: http.Server = http.createServer(app);
const io: Server = new Server(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
});

app.use(upload.none());

// Detailed request logging middleware
app.use((req, res, next) => {
  console.log('Request Details:');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Headers:', req.headers);
  
  // Capture and log request body
  if (req.method !== 'GET') {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const parsedBody = rawBody ? JSON.parse(rawBody) : {};
        console.log('Request Body:', parsedBody);
      } catch (e) {
        console.error('Invalid JSON in request body:', e);
      }
    });
  }

  next();
});

// Middleware
app.use(cors());
app.use(express.json({
  verify: (req: any, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      console.error('Invalid JSON', e);
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Root endpoint for API documentation
app.use(apiDocumentationRoutes);

// Routes
app.use('/api', router);

// Error handling middleware
app.use(errorMiddleware);

// Global unhandled error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Global Error:', err);
  res.status(500).json({ 
    error: 'Unexpected error occurred',
    details: err instanceof Error ? err.message : 'Unknown error'
  });
});

// Initialize Socket.IO
initSocket(io);

// Start server
server.listen(config.port, () => {
  console.log(`Server running on port http://localhost:${config.port}`);
});

export default app;