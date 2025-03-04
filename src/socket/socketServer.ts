// src/socket/socketServer.ts
import { Server } from 'socket.io';

export const initSocket = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('User connected');
    socket.on('disconnect', () => console.log('User disconnected'));
  });
};
