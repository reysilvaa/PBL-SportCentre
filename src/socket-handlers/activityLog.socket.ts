import { Socket } from 'socket.io';
import {
  getIO,
  applyAuthMiddleware,
  setupNamespaceEvents,
} from '../config/server/socket';
import prisma from '../config/services/database';

/**
 * Handle activity logs subscription
 */
export const handleSubscribeActivityLogs = async (
  socket: Socket,
  options: { userId?: string },
) => {
  try {
    // If the client specifies a userId, join that specific room
    if (options.userId) {
      const userIdInt = parseInt(options.userId);
      const userRoom = `activity_logs_user_${userIdInt}`;
      socket.join(userRoom);
      console.log(`Client ${socket.id} joined ${userRoom}`);

      // Send initial data to the client
      const userLogs = await prisma.activityLog.findMany({
        where: { userId: userIdInt },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      socket.emit('activity_logs_initial', userLogs);
    }
  } catch (error) {
    console.error('Error handling activity logs subscription:', error);
  }
};

/**
 * Broadcast activity log updates to all connected clients and user-specific rooms
 */
export const broadcastActivityLogUpdates = async (userId?: number) => {
  const io = getIO();

  try {
    // If userId is provided, broadcast to that user's room
    if (userId) {
      const userLogs = await prisma.activityLog.findMany({
        where: { userId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      io.to(`activity_logs_user_${userId}`).emit(
        'activity_logs_updated',
        userLogs,
      );
      io.to(`user_${userId}`).emit('activity_logs_updated', userLogs);
      console.log(`Broadcast activity logs to user ${userId}`);
    }

    // Always broadcast to the general room
    const allLogs = await prisma.activityLog.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Broadcast using consistent event names
    io.to('activity_logs_all').emit('activity_logs_updated', allLogs);
    io.emit('activity-logs-updated', allLogs); // Legacy event name for compatibility
    console.log('Broadcast activity logs to all clients');
  } catch (error) {
    console.error('Error broadcasting activity log updates:', error);
  }
};

/**
 * Setup WebSocket handlers for activity logs
 */
export const setupActivityLogSocketHandlers = (): void => {
  const io = getIO();

  // Create a room name for all activity logs
  const roomName = 'activity_logs_all';

  // Set up a listener for client connections
  io.on('connection', (socket) => {
    console.log(`📊 Client connected to activity logs: ${socket.id}`);

    // Join the appropriate room
    socket.join(roomName);

    // Set up listener for when client wants to subscribe to activity logs
    socket.on('subscribe_activity_logs', (options: { userId?: string }) =>
      handleSubscribeActivityLogs(socket, options),
    );

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`📊 Client disconnected from activity logs: ${socket.id}`);
    });
  });

  console.log('✅ Activity log socket handlers initialized');
};
