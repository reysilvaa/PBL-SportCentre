import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Socket } from 'socket.io';

// Mock dependencies
jest.mock('../../../src/config/server/socket', () => ({
  getIO: jest.fn(() => ({
    of: jest.fn(() => ({
      on: jest.fn(),
      emit: jest.fn(),
    })),
  })),
  applyAuthMiddleware: jest.fn(),
  setupNamespaceEvents: jest.fn(),
}));

jest.mock('../../../src/utils/booking/checkAvailability.utils', () => ({
  isFieldAvailable: jest.fn(),
  getAllFieldsAvailability: jest.fn(),
  getAvailableTimeSlots: jest.fn(),
}));

// Import the module after mocking dependencies
import * as FieldSocket from '../../../src/socket-handlers/field.socket';
import { isFieldAvailable, getAllFieldsAvailability, getAvailableTimeSlots } from '../../../src/utils/booking/checkAvailability.utils';
import { getIO } from '../../../src/config/server/socket';

describe('Field Socket Handlers', () => {
  let mockSocket: any;
  let mockCallback: jest.Mock;
  let mockIO: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock socket
    mockSocket = {
      id: 'socket-id-123',
      emit: jest.fn(),
      broadcast: {
        emit: jest.fn(),
      },
    } as unknown as Socket;

    // Create mock callback
    mockCallback = jest.fn();

    // Setup mock IO
    mockIO = {
      of: jest.fn(() => ({
        on: jest.fn(),
        emit: jest.fn(),
      })),
    };
    (getIO as jest.Mock).mockReturnValue(mockIO);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCheckAllFieldsAvailability', () => {
    it('seharusnya mengembalikan semua field availability', async () => {
      // Mock data
      const mockResults = [
        { fieldId: 1, available: true },
        { fieldId: 2, available: false },
      ];
      (getAllFieldsAvailability as jest.Mock).mockResolvedValue(mockResults);

      // Mock namespace
      const mockNamespace = {
        emit: jest.fn(),
      };
      mockIO.of.mockReturnValue(mockNamespace);

      // Execute function
      await FieldSocket.handleCheckAllFieldsAvailability(mockSocket, {}, mockCallback);

      // Assertions
      expect(getAllFieldsAvailability).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        data: mockResults,
      });
      expect(mockIO.of).toHaveBeenCalledWith('/fields');
      expect(mockNamespace.emit).toHaveBeenCalledWith('fieldsAvailabilityUpdate', mockResults);
    });

    it('seharusnya menangani error', async () => {
      // Mock error
      const mockError = new Error('Database error');
      (getAllFieldsAvailability as jest.Mock).mockRejectedValue(mockError);

      // Execute function
      await FieldSocket.handleCheckAllFieldsAvailability(mockSocket, {}, mockCallback);

      // Assertions
      expect(getAllFieldsAvailability).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to check all fields availability',
      });
    });
  });

  describe('handleCheckFieldAvailability', () => {
    it('seharusnya mengembalikan status availability dari field', async () => {
      // Mock data
      const mockData = {
        fieldId: 1,
        bookingDate: '2023-05-01',
        startTime: '10:00',
        endTime: '12:00',
      };
      (isFieldAvailable as jest.Mock).mockResolvedValue(true);

      // Execute function
      await FieldSocket.handleCheckFieldAvailability(mockSocket, mockData, mockCallback);

      // Assertions
      expect(isFieldAvailable).toHaveBeenCalledWith(
        1,
        expect.any(Date),
        expect.any(Date),
        expect.any(Date)
      );
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        data: { isAvailable: true },
      });
    });

    it('seharusnya menangani parameter yang tidak lengkap', async () => {
      // Mock incomplete data
      const mockData = {
        fieldId: 1,
        // Missing other required fields
      };

      // Execute function
      await FieldSocket.handleCheckFieldAvailability(mockSocket, mockData, mockCallback);

      // Assertions
      expect(isFieldAvailable).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required parameters',
      });
    });

    it('seharusnya menangani error', async () => {
      // Mock data
      const mockData = {
        fieldId: 1,
        bookingDate: '2023-05-01',
        startTime: '10:00',
        endTime: '12:00',
      };
      
      // Mock error
      const mockError = new Error('Database error');
      (isFieldAvailable as jest.Mock).mockRejectedValue(mockError);

      // Execute function
      await FieldSocket.handleCheckFieldAvailability(mockSocket, mockData, mockCallback);

      // Assertions
      expect(isFieldAvailable).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to check field availability',
      });
    });
  });

  describe('handleGetAvailableTimeSlots', () => {
    it('seharusnya mengembalikan available time slots', async () => {
      // Mock data
      const mockData = {
        fieldId: 1,
        date: '2023-05-01',
      };
      const mockSlots = [
        { start: '09:00', end: '10:00' },
        { start: '10:00', end: '11:00' },
      ];
      (getAvailableTimeSlots as jest.Mock).mockResolvedValue(mockSlots);

      // Execute function
      await FieldSocket.handleGetAvailableTimeSlots(mockSocket, mockData, mockCallback);

      // Assertions
      expect(getAvailableTimeSlots).toHaveBeenCalledWith(1, expect.any(Date));
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        data: { availableSlots: mockSlots },
      });
    });

    it('seharusnya menangani parameter yang tidak lengkap', async () => {
      // Mock incomplete data
      const mockData = {
        // Missing fieldId and date
      };

      // Execute function
      await FieldSocket.handleGetAvailableTimeSlots(mockSocket, mockData, mockCallback);

      // Assertions
      expect(getAvailableTimeSlots).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Field ID and date are required',
      });
    });

    it('seharusnya menangani error', async () => {
      // Mock data
      const mockData = {
        fieldId: 1,
        date: '2023-05-01',
      };
      
      // Mock error
      const mockError = new Error('Database error');
      (getAvailableTimeSlots as jest.Mock).mockRejectedValue(mockError);

      // Execute function
      await FieldSocket.handleGetAvailableTimeSlots(mockSocket, mockData, mockCallback);

      // Assertions
      expect(getAvailableTimeSlots).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to get available time slots',
      });
    });
  });

  describe('setupFieldSocketHandlers', () => {
    it('seharusnya mengatur socket handlers untuk field namespace', () => {
      // Setup mock namespaces and event handlers
      const mockOn = jest.fn();
      const mockNamespace = {
        on: mockOn,
      };
      mockIO.of.mockReturnValue(mockNamespace);

      // Execute function
      FieldSocket.setupFieldSocketHandlers();

      // Assertions
      expect(mockIO.of).toHaveBeenCalledWith('/fields');
      expect(mockNamespace.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });
}); 