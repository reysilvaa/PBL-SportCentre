import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { Namespace } from 'socket.io';
import { auth } from '../../middlewares/auth.middleware';
import { corsConfig } from './cors';
import { KEYS } from '../services/redis';

// Definisikan konfigurasi Socket yang standar
export const SOCKET_CONFIG = {
  pingTimeout: 60000,
  pingInterval: 25000,
  maxPayload: 50000,
};

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
      cors: corsConfig(),
      // Gunakan konfigurasi standar
      pingTimeout: SOCKET_CONFIG.pingTimeout,
      pingInterval: SOCKET_CONFIG.pingInterval,
    });

    console.log('Socket.IO server initialized');
    
    // Buat namespace untuk ketersediaan lapangan - menggunakan namespace dari redis.ts
    const fieldsNamespace = global.io.of(`/${KEYS.SOCKET.FIELDS}`);
    setupFieldsNamespace(fieldsNamespace);
    
    // Buat namespace untuk notifikasi - menggunakan namespace dari redis.ts
    const notificationNamespace = global.io.of(`/${KEYS.SOCKET.NOTIFICATION}`);
    setupNotificationNamespace(notificationNamespace);
  }

  return global.io;
}

/**
 * Setup namespace khusus untuk ketersediaan lapangan
 * @param namespace Socket.IO namespace
 */
export function setupFieldsNamespace(namespace: Namespace): void {
  namespace.on('connection', (socket) => {
    console.log(`Client connected to ${KEYS.SOCKET.FIELDS} namespace - ID: ${socket.id}`);

    // Event untuk bergabung ke room
    socket.on('join_room', ({ room, branchId }) => {
      // Join room berdasarkan nama room yang dikirim
      if (room) {
        socket.join(room);
        console.log(`Client ${socket.id} joined room: ${room}, branchId: ${branchId || 'none'}`);
        
        // Emit event bahwa client berhasil bergabung ke room
        socket.emit('joined_room', { room, success: true });
      }
    });

    // Event untuk meninggalkan room
    socket.on('leave_room', ({ room }) => {
      if (room) {
        socket.leave(room);
        console.log(`Client ${socket.id} left room: ${room}`);
        
        // Emit event bahwa client berhasil keluar dari room
        socket.emit('left_room', { room, success: true });
      }
    });
    
    // Event untuk meminta pembaruan ketersediaan lapangan
    socket.on('request_availability_update', async ({ date, branchId }) => {
      try {
        console.log(`Client ${socket.id} requested availability update for date: ${date || 'all'}, branchId: ${branchId || 'all'}`);
        
        // Import di sini untuk menghindari circular dependency
        const { getAllFieldsAvailability } = require('../../utils/booking/checkAvailability.utils');
        
        // Dapatkan data ketersediaan terbaru
        const availabilityData = await getAllFieldsAvailability(date);
        
        // Filter data berdasarkan branchId jika ada
        const filteredData = branchId 
          ? availabilityData.filter((field: any) => {
              const fieldBranchId = field.branchId || 
                (field.field && field.field.branchId) || 
                (field.branch && field.branch.id);
              return fieldBranchId === branchId;
            })
          : availabilityData;
        
        // Emit langsung ke client yang meminta
        socket.emit('fieldsAvailabilityUpdate', filteredData);
        
        console.log(`Sent availability update to client ${socket.id} for date: ${date || 'all'}`);
      } catch (error) {
        console.error(`Error sending availability update to client ${socket.id}:`, error);
        socket.emit('error', { message: 'Failed to get availability data' });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected from ${KEYS.SOCKET.FIELDS} namespace - ID: ${socket.id} - Reason: ${reason}`);
    });
  });
}

/**
 * Setup namespace khusus untuk notifikasi
 * @param namespace Socket.IO namespace
 */
export function setupNotificationNamespace(namespace: Namespace): void {
  // Terapkan auth middleware ke namespace notifikasi
  applyAuthMiddleware(namespace, false); // Parameter false: koneksi tanpa auth masih diizinkan
  
  namespace.on('connection', (socket) => {
    console.log(`Client connected to ${KEYS.SOCKET.NOTIFICATION} namespace - ID: ${socket.id}`);
    
    // Mengambil user dari socket data jika ada
    const userId = socket.data.user?.id;
    if (userId) {
      // Join ke room khusus user
      const userRoom = `user:${userId}`;
      socket.join(userRoom);
      console.log(`User ${userId} joined their notification room: ${userRoom}`);
    }

    // Event untuk bergabung ke room notifikasi
    socket.on('join_notification_room', ({ roomId, userId }) => {
      if (roomId) {
        socket.join(roomId);
        console.log(`Client ${socket.id} joined notification room: ${roomId}, userId: ${userId || 'anonymous'}`);
        
        socket.emit('joined_notification_room', { room: roomId, success: true });
      }
    });

    // Event untuk meninggalkan room notifikasi
    socket.on('leave_notification_room', ({ roomId }) => {
      if (roomId) {
        socket.leave(roomId);
        console.log(`Client ${socket.id} left notification room: ${roomId}`);
        
        socket.emit('left_notification_room', { room: roomId, success: true });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected from ${KEYS.SOCKET.NOTIFICATION} namespace - ID: ${socket.id} - Reason: ${reason}`);
    });
  });
}

/**
 * Emit pembaruan ketersediaan lapangan ke semua client di room tertentu
 * @param data Data ketersediaan lapangan
 * @param date Tanggal (untuk filter room)
 */
export function emitFieldAvailabilityUpdate(data: any, date?: string): void {
  try {
    const io = getIO();
    const fieldsNamespace = io.of(`/${KEYS.SOCKET.FIELDS}`);
    
    // Emit ke room spesifik berdasarkan tanggal
    if (date) {
      const roomId = `field_availability_${date}`;
      console.log(`Emitting field availability update to room: ${roomId}, clients: ${getClientsInRoom(fieldsNamespace, roomId)}`);
      fieldsNamespace.to(roomId).emit('fieldsAvailabilityUpdate', data);
    } 
    // Emit ke semua client di namespace fields
    else {
      console.log(`Emitting field availability update to all clients in ${KEYS.SOCKET.FIELDS} namespace`);
      fieldsNamespace.emit('fieldsAvailabilityUpdate', data);
    }
  } catch (error) {
    console.error('Failed to emit field availability update:', error);
  }
}

/**
 * Emit notifikasi ke user tertentu
 * @param userId ID user yang akan menerima notifikasi
 * @param notification Data notifikasi
 */
export function emitNotificationToUser(userId: string, notification: any): void {
  try {
    const io = getIO();
    const notificationNamespace = io.of(`/${KEYS.SOCKET.NOTIFICATION}`);
    
    const roomId = `user:${userId}`;
    console.log(`Emitting notification to user ${userId} in room: ${roomId}`);
    notificationNamespace.to(roomId).emit('notification', notification);
  } catch (error) {
    console.error(`Failed to emit notification to user ${userId}:`, error);
  }
}

/**
 * Emit notifikasi ke room tertentu
 * @param roomId ID room yang akan menerima notifikasi
 * @param notification Data notifikasi
 */
export function emitNotificationToRoom(roomId: string, notification: any): void {
  try {
    const io = getIO();
    const notificationNamespace = io.of(`/${KEYS.SOCKET.NOTIFICATION}`);
    
    console.log(`Emitting notification to room: ${roomId}, clients: ${getClientsInRoom(notificationNamespace, roomId)}`);
    notificationNamespace.to(roomId).emit('notification', notification);
  } catch (error) {
    console.error(`Failed to emit notification to room ${roomId}:`, error);
  }
}

/**
 * Bantuan untuk mendapatkan jumlah client dalam room tertentu
 * @param namespace Socket.IO namespace
 * @param room Nama room
 * @returns Jumlah client dalam room
 */
export function getClientsInRoom(namespace: Namespace, room: string): number {
  const adapter = namespace.adapter;
  // @ts-ignore - Room property exists but is not in typings
  return adapter.rooms.get(room)?.size || 0;
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
export function applyAuthMiddleware(namespace: Namespace, requireAuth: boolean = true): void {
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
      } catch {
        if (!requireAuth) {
          socket.data.user = null;
          return next();
        }
        next(new Error('Authentication failed'));
      }
    } catch {
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
    console.log(`Client connected to ${namespace.name || '/'} - ID: ${socket.id}`);

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
