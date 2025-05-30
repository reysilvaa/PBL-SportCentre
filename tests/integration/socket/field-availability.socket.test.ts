import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Server } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { KEYS } from '../../../src/config/services/redis';
import { setupFieldsNamespace } from '../../../src/config/server/socket';

// Mock Redis and related dependencies
jest.mock('../../../src/config/services/redis', () => ({
  KEYS: {
    SOCKET: {
      FIELDS: 'fields',
      NOTIFICATION: 'notification'
    }
  },
  NAMESPACE: {
    PREFIX: 'sportcenter',
    FIELDS: 'fields'
  }
}));

// Mock Booking utility used by field socket handlers
jest.mock('../../../src/utils/booking/checkAvailability.utils', () => ({
  getAllFieldsAvailability: jest.fn().mockResolvedValue([
    {
      fieldId: 1,
      fieldName: 'Test Field 1',
      branch: 'Test Branch',
      isAvailable: true,
      availableTimeSlots: [
        { start: new Date('2023-08-15T08:00:00Z'), end: new Date('2023-08-15T10:00:00Z') }
      ]
    }
  ]),
  getAvailableTimeSlots: jest.fn().mockResolvedValue([
    { start: new Date('2023-08-15T08:00:00Z'), end: new Date('2023-08-15T10:00:00Z') }
  ]),
  isFieldAvailable: jest.fn().mockResolvedValue(true)
}));

describe('Field Availability Socket Integration', () => {
  let httpServer: Server;
  let socketServer: SocketServer;
  let clientSocket: ClientSocket;
  let app: any;
  const port = 4000;
  
  beforeAll((done) => {
    // Setup Express app and HTTP server
    app = express();
    httpServer = new Server(app);
    
    // Setup Socket.IO server
    socketServer = new SocketServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    // Initialize the fields namespace
    const fieldsNamespace = socketServer.of(`/${KEYS.SOCKET.FIELDS}`);
    setupFieldsNamespace(fieldsNamespace);
    
    // Start the server
    httpServer.listen(port, () => {
      // Connect client socket
      clientSocket = ioClient(`http://localhost:${port}/${KEYS.SOCKET.FIELDS}`, {
        transports: ['websocket'],
        autoConnect: false
      });
      
      clientSocket.on('connect', () => {
        done();
      });
      
      clientSocket.connect();
    });
  });
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  afterAll(() => {
    // Close connections
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    socketServer.close();
    httpServer.close();
  });
  
  it('should emit field availability update when requested', (done) => {
    // Set up a listener for the fieldsAvailabilityUpdate event
    clientSocket.on('fieldsAvailabilityUpdate', (data) => {
      // Assertions
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0].fieldId).toBe(1);
      expect(data[0].fieldName).toBe('Test Field 1');
      expect(data[0].isAvailable).toBe(true);
      done();
    });
    
    // Request availability update
    clientSocket.emit('request_availability_update', { date: '2023-08-15' });
  });
  
  it('should allow joining a room based on date', (done) => {
    // Set up a listener for the joined_room event
    clientSocket.on('joined_room', (data) => {
      // Assertions
      expect(data.room).toBe('field_availability_2023-08-15');
      expect(data.success).toBe(true);
      done();
    });
    
    // Join a room
    clientSocket.emit('join_room', { room: 'field_availability_2023-08-15', branchId: 1 });
  });
  
  it('should allow leaving a room', (done) => {
    // Set up a listener for the left_room event
    clientSocket.on('left_room', (data) => {
      // Assertions
      expect(data.room).toBe('field_availability_2023-08-15');
      expect(data.success).toBe(true);
      done();
    });
    
    // Leave a room
    clientSocket.emit('leave_room', { room: 'field_availability_2023-08-15' });
  });
}); 