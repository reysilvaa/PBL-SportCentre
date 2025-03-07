// src/config/socket.ts

import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import cors from 'cors';

let io: SocketServer | null = null;

export function initializeSocketIO(server: HttpServer): SocketServer {
  if (!io) {
    io = new SocketServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Join a room specific to the user
      socket.on('join-user-room', (userId: number) => {
        socket.join(`user-${userId}`);
        console.log(`Socket ${socket.id} joined room user-${userId}`);
      });
      
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });

    console.log('Socket.IO server initialized');
  }
  
  return io;
}

export function getIO(): SocketServer {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}