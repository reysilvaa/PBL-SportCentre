import { Server, Socket } from 'socket.io';
import { initBookingSocket } from './ws/booking.ws';
import { initActivityLogSocket } from './ws/activityLog.ws';

export const initSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected to main socket');

    socket.on('disconnect', () => {
      console.log('Client disconnected from main socket');
    });
  });

  // namespaces
  initActivityLogSocket(io);
  initBookingSocket(io);
};
