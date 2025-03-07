import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { setupBookingHandlers } from "./handler/booking.ws.handler";
import { setupPaymentHandlers } from "./handler/payment.ws.handler";
import { setupMidtransHandlers } from "./handler/midtrans.ws.handler";
import { setupNotificationHandlers } from "./handler/notification.ws.handler";
import { authMiddleware } from "../middlewares/auth.middleware";

export function setupSocketServer(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*", // In production, restrict this to your domain
      methods: ["GET", "POST"],
    },
    path: "/socket.io", // Default path, can be customized
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        console.log("Warning: Connection without token");
        socket.data.user = { id: 0, name: "Anonymous" };
        return next();
      }

      const user = await authMiddleware(token);
      if (!user) {
        return next(new Error("Invalid authentication token"));
      }

      socket.data.user = user;
      next();
    } catch (error) {
      console.error("Socket auth error:", error);
      next(new Error("Authentication failed"));
    }
  });

  // Create namespaces for different features
  const bookingNamespace = io.of("/bookings");
  const paymentNamespace = io.of("/payments");
  const notificationNamespace = io.of("/notifications");

  // Apply authentication middleware to each namespace
  [bookingNamespace, paymentNamespace, notificationNamespace].forEach((namespace) => {
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

    namespace.on("connection", (socket) => {
      console.log(`Client connected to ${namespace.name} - ID: ${socket.id}`);

      socket.on("disconnect", (reason) => {
        console.log(`Client disconnected from ${namespace.name} - ID: ${socket.id} - Reason: ${reason}`);
      });

      socket.on("error", (error) => {
        console.error(`Socket error in ${namespace.name}:`, error);
      });
    });
  });

  // Set up event handlers for each namespace
  setupBookingHandlers(bookingNamespace);
  setupPaymentHandlers(paymentNamespace);
  setupMidtransHandlers(paymentNamespace); // Midtrans handlers share payment namespace
  setupNotificationHandlers(notificationNamespace);

  // Log when server starts
  console.log("Socket.IO server initialized");

  return io;
}
