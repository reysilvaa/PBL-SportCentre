// @ts-nocheck
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { 
  initializeSocketIO, 
  emitFieldAvailabilityUpdate,
  emitNotificationToUser,
  emitNotificationToRoom,
  getClientsInRoom,
  getIO
} from '../../../../src/config/server/socket';
import { KEYS } from '../../../../src/config/services/redis';

// Mock Socket.IO
jest.mock('socket.io', () => {
  const _mockSocket = {
    id: 'socket-id-123',
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    data: {},
  };
  
  const mockNamespace = {
    on: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    use: jest.fn().mockImplementation((fn) => fn),
    adapter: {
      rooms: new Map([['test-room', { size: 3 }]]),
    }
  };

  const mockIO = {
    of: jest.fn().mockReturnValue(mockNamespace),
    on: jest.fn(),
  };

  return {
    Server: jest.fn().mockImplementation(() => mockIO),
  };
});

// Mock HTTP server
const mockHttpServer = {} as HttpServer;

// Mock Redis KEYS
jest.mock('../../../../src/config/services/redis', () => ({
  KEYS: {
    SOCKET: {
      FIELDS: 'sportcenter/fields',
      NOTIFICATION: 'sportcenter/notification'
    }
  }
}));

// Mock checkAvailability utils to avoid circular dependency
jest.mock('../../../../src/utils/booking/checkAvailability.utils', () => ({
  getAllFieldsAvailability: jest.fn().mockResolvedValue([
    { fieldId: '1', available: true, branchId: '1' }
  ])
}));

// Mock auth middleware
jest.mock('../../../../src/middlewares/auth.middleware', () => ({
  auth: {
    socketAuth: jest.fn((socket, next) => next())
  }
}));

describe('Socket.IO Configuration', () => {
  beforeEach(() => {
    // Reset the global.io before each test
    global.io = undefined;
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    global.io = undefined;
  });

  describe('initializeSocketIO', () => {
    it('should initialize a Socket.IO server', () => {
      const io = initializeSocketIO(mockHttpServer);
      
      expect(SocketServer).toHaveBeenCalledWith(mockHttpServer, expect.any(Object));
      expect(global.io).toBeDefined();
      expect(io).toBe(global.io);
    });

    it('should reuse existing Socket.IO instance if it exists', () => {
      // Initialize once
      const firstIo = initializeSocketIO(mockHttpServer);
      
      // Clear mocks to check if they are called again
      jest.clearAllMocks();
      
      // Initialize again
      const secondIo = initializeSocketIO(mockHttpServer);
      
      // Should not create a new server
      expect(SocketServer).not.toHaveBeenCalled();
      expect(firstIo).toBe(secondIo);
    });
  });

  describe('Namespace setup', () => {
    it('should setup namespaces when initializing socket.io', () => {
      // Initialize Socket.IO
      initializeSocketIO(mockHttpServer);
      
      // Get the namespaces
      const fieldsNamespace = global.io.of(`/${KEYS.SOCKET.FIELDS}`);
      const notificationNamespace = global.io.of(`/${KEYS.SOCKET.NOTIFICATION}`);
      
      // Verify namespaces were created
      expect(global.io.of).toHaveBeenCalledWith(`/${KEYS.SOCKET.FIELDS}`);
      expect(global.io.of).toHaveBeenCalledWith(`/${KEYS.SOCKET.NOTIFICATION}`);
      
      // Verify namespace.on('connection') was called for both namespaces
      expect(fieldsNamespace.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(notificationNamespace.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('emitFieldAvailabilityUpdate', () => {
    it('should emit field availability update to a specific room', () => {
      // Initialize Socket.IO
      initializeSocketIO(mockHttpServer);
      
      const testData = { fields: [{ id: '1', available: true }] };
      const testDate = '2023-05-01';
      
      // Call the function
      emitFieldAvailabilityUpdate(testData, testDate);
      
      // Get the namespace
      const namespace = global.io.of(`/${KEYS.SOCKET.FIELDS}`);
      
      // Verify namespace.to() and emit() were called with correct parameters
      expect(namespace.to).toHaveBeenCalledWith(`field_availability_${testDate}`);
      expect(namespace.emit).toHaveBeenCalledWith('fieldsAvailabilityUpdate', testData);
    });
    
    it('should emit field availability update to all clients when no date is provided', () => {
      // Initialize Socket.IO
      initializeSocketIO(mockHttpServer);
      
      const testData = { fields: [{ id: '1', available: true }] };
      
      // Call the function without date
      emitFieldAvailabilityUpdate(testData);
      
      // Get the namespace
      const namespace = global.io.of(`/${KEYS.SOCKET.FIELDS}`);
      
      // Verify emit was called with correct parameters to all clients
      expect(namespace.emit).toHaveBeenCalledWith('fieldsAvailabilityUpdate', testData);
    });
  });

  describe('emitNotificationToUser', () => {
    it('should emit notification to a specific user room', () => {
      // Initialize Socket.IO
      initializeSocketIO(mockHttpServer);
      
      const userId = 'user-123';
      const notification = { message: 'Test notification' };
      
      // Call the function
      emitNotificationToUser(userId, notification);
      
      // Get the namespace
      const namespace = global.io.of(`/${KEYS.SOCKET.NOTIFICATION}`);
      
      // Verify namespace.to() and emit() were called with correct parameters
      expect(namespace.to).toHaveBeenCalledWith(`user:${userId}`);
      expect(namespace.emit).toHaveBeenCalledWith('notification', notification);
    });
  });

  describe('emitNotificationToRoom', () => {
    it('should emit notification to a specific room', () => {
      // Initialize Socket.IO
      initializeSocketIO(mockHttpServer);
      
      const roomId = 'test-room';
      const notification = { message: 'Test notification' };
      
      // Call the function
      emitNotificationToRoom(roomId, notification);
      
      // Get the namespace
      const namespace = global.io.of(`/${KEYS.SOCKET.NOTIFICATION}`);
      
      // Verify namespace.to() and emit() were called with correct parameters
      expect(namespace.to).toHaveBeenCalledWith(roomId);
      expect(namespace.emit).toHaveBeenCalledWith('notification', notification);
    });
  });

  describe('getClientsInRoom', () => {
    it('should return the number of clients in a room', () => {
      // Initialize Socket.IO
      initializeSocketIO(mockHttpServer);
      
      // Setup mock namespace with room
      const namespace = global.io.of(`/${KEYS.SOCKET.FIELDS}`);
      
      // Call the function
      const clientCount = getClientsInRoom(namespace, 'test-room');
      
      // Verify correct count is returned
      expect(clientCount).toBe(3);
    });
    
    it('should return 0 when room does not exist', () => {
      // Initialize Socket.IO
      initializeSocketIO(mockHttpServer);
      
      // Setup mock namespace
      const namespace = global.io.of(`/${KEYS.SOCKET.FIELDS}`);
      
      // Call the function with non-existent room
      const clientCount = getClientsInRoom(namespace, 'non-existent-room');
      
      // Verify 0 is returned
      expect(clientCount).toBe(0);
    });
  });

  describe('getIO', () => {
    it('should return the Socket.IO instance', () => {
      // Initialize Socket.IO
      initializeSocketIO(mockHttpServer);
      
      // Call the function
      const io = getIO();
      
      // Verify correct instance is returned
      expect(io).toBe(global.io);
    });
    
    it('should throw an error when Socket.IO is not initialized', () => {
      // Ensure io is undefined
      global.io = undefined;
      
      // Call the function should throw
      expect(() => getIO()).toThrow('Socket.IO not initialized');
    });
  });
}); 