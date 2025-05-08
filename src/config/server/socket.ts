import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { Namespace } from 'socket.io';
import { auth } from '../../middlewares/auth.middleware';

declare global {
  // eslint-disable-next-line no-var
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
        origin: '*',
        // || process.env.FRONTEND_URL || 'http://localhost:3000'
        methods: ['GET', 'POST'],
        credentials: true,
      },
      // Increase ping timeout and interval for better connection stability
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    console.log('Socket.IO server initialized');
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
 * @param requireAuth Whether authentication is required (default: true)
 */
export function applyAuthMiddleware(
  namespace: Namespace,
  requireAuth: boolean = true
): void {
  namespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      // If token is not provided but auth is not required, allow connection
      if (!token) {
        if (!requireAuth) {
          socket.data.user = null;
          return next();
        }
        return next(new Error('Authentication token is required'));
      }

      // Verify token
      try {
        const user = await auth(token);
        if (!user) {
          if (!requireAuth) {
            socket.data.user = null;
            return next();
          }
          return next(new Error('Invalid authentication token'));
        }

        socket.data.user = user;
        next();
      } catch (authError) {
        if (!requireAuth) {
          socket.data.user = null;
          return next();
        }
        next(new Error('Authentication failed'));
      }
    } catch (log) {
      if (!requireAuth) {
        socket.data.user = null;
        return next();
      }
      next(new Error('Authentication failed'));
    }
  });
}

/**
 * Set up basic connection events for a namespace
 * @param namespace Socket.IO namespace
 */
export function setupNamespaceEvents(namespace: Namespace): void {
  namespace.on('connection', (socket) => {
    console.log(
      `Client connected to ${namespace.name || '/'} - ID: ${socket.id}`
    );

    socket.on('disconnect', (reason) => {
      console.log(
        `Client disconnected from ${namespace.name || '/'} - ID: ${socket.id} - Reason: ${reason}`
      );
    });

    socket.on('log', (log) => {
      console.log(`Socket log in ${namespace.name || '/'}:`, log);
    });
  });
}
