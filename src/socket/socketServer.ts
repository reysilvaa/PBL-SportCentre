import { Server as HttpServer } from "http";
import { getIO, applyAuthMiddleware, setupNamespaceEvents } from "../config/socket";
import { setupBookingHandlers } from "./handlers/booking.ws.handler";
import { setupPaymentHandlers } from "./handlers/payment.ws.handler";
import { setupMidtransHandlers } from "./handlers/midtrans.ws.handler";

/**
 * Set up Socket.IO server with all namespaces and handlers
 * @param httpServer HTTP server instance
 * @returns Socket.IO server instance or null if initialization failed
 */
export function setupSocketServer(httpServer: HttpServer) {
  try {
    // Get the global io instance
    const io = getIO();
    
    // Create namespaces
    const bookingNamespace = io.of("/bookings");
    const paymentNamespace = io.of("/payments");
    const notificationNamespace = io.of("/notifications");
    
    // Set up authentication for each namespace
    const namespaces = [bookingNamespace, paymentNamespace, notificationNamespace];
    namespaces.forEach(namespace => {
      applyAuthMiddleware(namespace);
      setupNamespaceEvents(namespace);
    });

    // Set up event handlers for each namespace
    setupBookingHandlers(bookingNamespace);
    setupPaymentHandlers(paymentNamespace);
    setupMidtransHandlers(paymentNamespace);

    // Set up the main io connection handler
    io.on('connection', (socket) => {
      console.log(`📡 Main client connected - ID: ${socket.id}`);
      
      // Join a room specific to the user
      socket.on('join-user-room', (userId: number) => {
        const roomName = `user_${userId}`;
        socket.join(roomName);
        console.log(`👤 Socket ${socket.id} joined room ${roomName}`);
      });
      
      socket.on('disconnect', () => {
        console.log(`🔌 Main client disconnected - ID: ${socket.id}`);
      });
    });

    console.log("✅ Socket.IO handlers setup completed");
    return io;
  } catch (error) {
    console.error("❌ Failed to set up Socket.IO server:", error);
    return null;
  }
}