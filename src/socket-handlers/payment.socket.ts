import { Socket } from 'socket.io';
import {
  getIO,
  applyAuthMiddleware,
  setupNamespaceEvents,
} from '../config/server/socket';

/**
 * Handle payment status update
 */
export const handlePaymentStatusUpdate = (socket: Socket, data: any) => {
  try {
    const { paymentId, bookingId, status, userId } = data;

    // Broadcast to all clients in the payments namespace
    socket.broadcast.emit('status_change', {
      paymentId,
      bookingId,
      status,
      userId,
    });

    // Also emit to user-specific room if userId is provided
    if (userId) {
      const io = getIO();
      io.to(`user_${userId}`).emit('payment_update', {
        paymentId,
        bookingId,
        status,
        message: `Your payment status is now ${status}`,
      });
    }
  } catch (error) {
    console.error('Error handling payment status update:', error);
  }
};

/**
 * Send payment notification from webhook
 * This function is used by webhook controller to send real-time notifications
 */
export const sendPaymentNotification = (data: {
  paymentId: number;
  bookingId: number;
  status: string;
  userId: number;
}) => {
  try {
    const { paymentId, bookingId, status, userId } = data;
    const io = getIO();

    if (!io) {
      console.warn(
        '⚠️ Socket.IO not initialized, skipping real-time notification',
      );
      return;
    }

    const userRoomId = `user_${userId}`;

    // Emit to user's specific room
    io.to(userRoomId).emit('payment_update', {
      paymentId,
      bookingId,
      status,
      message: `Your payment status is now ${status}`,
    });

    // Also emit to the payments namespace for any admin dashboards
    io.of('/payments').emit('status_change', {
      paymentId,
      bookingId,
      status,
      userId,
    });

    console.log(
      `📢 Sent real-time payment updates to ${userRoomId} and /payments namespace`,
    );
  } catch (error) {
    console.error('❌ Socket.IO Error:', error);
    // Continue processing even if socket notification fails
  }
};

/**
 * Setup WebSocket handlers for payments
 */
export const setupPaymentSocketHandlers = (): void => {
  const io = getIO();
  const paymentsNamespace = io.of('/payments');

  // Apply authentication middleware (optional)
  applyAuthMiddleware(paymentsNamespace, false);

  // Set up basic namespace events
  setupNamespaceEvents(paymentsNamespace);

  paymentsNamespace.on('connection', (socket: Socket) => {
    console.log(`💳 Payment client connected: ${socket.id}`);

    // Handle payment status update
    socket.on('status_change', (data) =>
      handlePaymentStatusUpdate(socket, data),
    );

    // Handle client leaving
    socket.on('disconnect', () => {
      console.log(`💳 Payment client disconnected: ${socket.id}`);
    });
  });

  console.log('✅ Payment socket handlers initialized');
};
