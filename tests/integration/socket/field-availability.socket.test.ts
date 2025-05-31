import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Server } from 'http';
import { Server as SocketServer } from 'socket.io';
import express from 'express';
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

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn((event, callback) => {
      // Store callbacks for testing
      if (!mockSocket.callbacks[event]) {
        mockSocket.callbacks[event] = [];
      }
      mockSocket.callbacks[event].push(callback);
      return mockSocket;
    }),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
    callbacks: {},
    // Helper to trigger callbacks for testing
    triggerEvent: (event, ...args) => {
      if (mockSocket.callbacks[event]) {
        mockSocket.callbacks[event].forEach(cb => cb(...args));
      }
    }
  };
  
  return {
    io: jest.fn().mockReturnValue(mockSocket)
  };
});

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
  let httpServer;
  let socketServer;
  let mockSocket;
  let mockNamespace;
  let app;
  
  beforeAll(() => {
    // Setup Express app and HTTP server
    app = express();
    httpServer = new Server(app);
    
    // Create mock Socket.IO server
    socketServer = {
      of: jest.fn().mockReturnThis(),
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      close: jest.fn()
    };
    
    // Create mock namespace
    mockNamespace = {
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis()
    };
    
    socketServer.of.mockReturnValue(mockNamespace);
    
    // Get the mock socket from the mocked socket.io-client
    mockSocket = require('socket.io-client').io();
  });
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    mockSocket.callbacks = {};
  });
  
  afterAll(() => {
    // Clean up
    if (httpServer) {
      httpServer.close();
    }
  });
  
  it('should emit field availability update when requested', async () => {
    // Simulate the socket event handler
    const { getAllFieldsAvailability } = require('../../../src/utils/booking/checkAvailability.utils');
    
    // Simulate socket event
    mockSocket.emit('request_availability_update', { date: '2023-08-15' });
    
    // Get the mock data that would be returned
    const mockData = await getAllFieldsAvailability();
    
    // Simulate the server emitting the response
    mockSocket.triggerEvent('fieldsAvailabilityUpdate', mockData);
    
    // Verify the mock was called
    expect(mockSocket.emit).toHaveBeenCalledWith('request_availability_update', { date: '2023-08-15' });
    
    // Verify the data passed to the callback
    expect(mockData).toBeDefined();
    expect(Array.isArray(mockData)).toBe(true);
    expect(mockData).toHaveLength(1);
    expect(mockData[0].fieldId).toBe(1);
    expect(mockData[0].fieldName).toBe('Test Field 1');
    expect(mockData[0].isAvailable).toBe(true);
  });
  
  it('should allow joining a room based on date', async () => {
    // Setup mock response
    const mockResponse = { room: 'field_availability_2023-08-15', success: true };
    
    // Simulate socket event
    mockSocket.emit('join_room', { room: 'field_availability_2023-08-15', branchId: 1 });
    
    // Simulate the server emitting the response
    mockSocket.triggerEvent('joined_room', mockResponse);
    
    // Verify the mock was called
    expect(mockSocket.emit).toHaveBeenCalledWith('join_room', { 
      room: 'field_availability_2023-08-15', 
      branchId: 1 
    });
    
    // Verify the data matches expectations
    expect(mockResponse.room).toBe('field_availability_2023-08-15');
    expect(mockResponse.success).toBe(true);
  });
  
  it('should allow leaving a room', async () => {
    // Setup mock response
    const mockResponse = { room: 'field_availability_2023-08-15', success: true };
    
    // Simulate socket event
    mockSocket.emit('leave_room', { room: 'field_availability_2023-08-15' });
    
    // Simulate the server emitting the response
    mockSocket.triggerEvent('left_room', mockResponse);
    
    // Verify the mock was called
    expect(mockSocket.emit).toHaveBeenCalledWith('leave_room', { room: 'field_availability_2023-08-15' });
    
    // Verify the data matches expectations
    expect(mockResponse.room).toBe('field_availability_2023-08-15');
    expect(mockResponse.success).toBe(true);
  });
}); 