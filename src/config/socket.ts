import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { Namespace } from 'socket.io';
import { authMiddleware } from '../middlewares/auth.middleware';

declare global {
  var io: SocketServer | any;
}

/**
 * Initialize Socket.IO server and attach it to the HTTP server
 * @param server HTTP server instance
 * @returns Socket.IO server instance
 */
export function initializeSocketIO(server: HttpServer): SocketServer {
  if (!global.io) {
    global.io = new SocketServer(server, {
      cors: {
        origin: '*' ,
        // || process.env.FRONTEND_URL || 'http://localhost:3000' 
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    console.log('✅ Socket.IO server initialized');
  }
  
  return global.io;
}

/**
 * Get the Socket.IO server instance
 * @returns Socket.IO server instance
 * @throws Error if Socket.IO is not initialized
 */
export function getIO(): SocketServer {
  if (!global.io) {
    throw new Error('❌ Socket.IO not initialized');
  }
  return global.io;
}

/**
 * Apply authentication middleware to a Socket.IO namespace
 * @param namespace Socket.IO namespace
 */
export function applyAuthMiddleware(namespace: Namespace): void {
  namespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication token is required"));
      }

      const user = await authMiddleware(token);
      if (!user) {
        return next(new Error("Invalid authentication token"));
      }

      socket.data.user = user;
      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });
}

/**
 * Set up basic connection events for a namespace
 * @param namespace Socket.IO namespace
 */
export function setupNamespaceEvents(namespace: Namespace): void {
  namespace.on("connection", (socket) => {
    console.log(`📡 Client connected to ${namespace.name} - ID: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Client disconnected from ${namespace.name} - ID: ${socket.id} - Reason: ${reason}`);
    });

    socket.on("error", (error) => {
      console.error(`❌ Socket error in ${namespace.name}:`, error);
    });
  });
}