import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Socket } from 'socket.io';

// Mock dependencies
jest.mock('../../../src/config/server/socket', () => ({
  getIO: jest.fn(() => ({
    of: jest.fn(() => ({
      on: jest.fn(),
      use: jest.fn(),
    })),
  })),
}));

jest.mock('../../../src/config/services/database', () => ({
  __esModule: true,
  default: {
    booking: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    field: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../src/middlewares/auth.middleware', () => ({
  authMiddleware: jest.fn(),
}));

jest.mock('../../../src/utils/booking/booking.utils', () => ({
  validateBookingTime: jest.fn(),
  verifyFieldBranch: jest.fn(),
  createBookingWithPayment: jest.fn(),
  getCompleteBooking: jest.fn(),
  emitBookingEvents: jest.fn(),
}));

// Import the module after mocking dependencies
import * as BranchSocket from '../../../src/socket-handlers/branch.socket';
import { getIO } from '../../../src/config/server/socket';
import prisma from '../../../src/config/services/database';
import { authMiddleware } from '../../../src/middlewares/auth.middleware';
import {
  validateBookingTime,
  verifyFieldBranch,
  createBookingWithPayment,
  getCompleteBooking,
  emitBookingEvents,
} from '../../../src/utils/booking/booking.utils';

describe('Branch Socket Handlers', () => {
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
      join: jest.fn(),
      data: {
        user: null,
        authenticated: false,
      },
      on: jest.fn(),
      leave: jest.fn(),
    } as unknown as Socket;

    // Create mock callback
    mockCallback = jest.fn();

    // Setup mock IO
    mockIO = {
      of: jest.fn(() => ({
        on: jest.fn(),
        use: jest.fn(),
      })),
    };
    (getIO as jest.Mock).mockReturnValue(mockIO);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleBookingSearch', () => {
    it('seharusnya mengembalikan hasil pencarian booking', async () => {
      // Setup authenticated socket
      mockSocket.data.authenticated = true;
      mockSocket.data.user = { id: 1, role: 'admin' };

      // Mock data
      const mockData = {
        query: 'test',
        branchId: '1',
      };

      const mockBookings = [
        { id: 1, user: { name: 'Test User' }, field: {}, payment: {} },
      ];

      // Mock database response
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);

      // Execute function
      await BranchSocket.handleBookingSearch(mockSocket, mockData);

      // Assertions
      expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          field: {
            branchId: 1,
          },
        }),
      }));
      expect(mockSocket.emit).toHaveBeenCalledWith('booking:search-results', mockBookings);
    });

    it('seharusnya mengembalikan error jika pengguna tidak terautentikasi', async () => {
      // Setup unauthenticated socket
      mockSocket.data.authenticated = false;
      mockSocket.data.user = null;

      // Mock data
      const mockData = {
        query: 'test',
        branchId: '1',
      };

      // Execute function
      await BranchSocket.handleBookingSearch(mockSocket, mockData);

      // Assertions
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('auth:required', expect.any(Object));
    });
  });

  describe('handleFieldAvailabilityCheck', () => {
    it('seharusnya mengembalikan hasil pengecekan ketersediaan lapangan', async () => {
      // Mock data
      const mockData = {
        fieldId: '1',
        bookingDate: '2023-05-01',
        startTime: '2023-05-01T10:00:00',
        endTime: '2023-05-01T12:00:00',
      };

      // Mock validation result
      (validateBookingTime as jest.Mock).mockResolvedValue({
        valid: true,
      });

      // Execute function
      await BranchSocket.handleFieldAvailabilityCheck(mockSocket, mockData);

      // Assertions
      expect(validateBookingTime).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('field:availability-result', expect.objectContaining({
        fieldId: '1',
        isAvailable: true,
      }));
    });

    it('seharusnya mengembalikan error jika validasi gagal', async () => {
      // Mock data
      const mockData = {
        fieldId: '1',
        bookingDate: '2023-05-01',
        startTime: '2023-05-01T10:00:00',
        endTime: '2023-05-01T12:00:00',
      };

      // Mock validation result
      (validateBookingTime as jest.Mock).mockResolvedValue({
        valid: false,
        message: 'Field not available',
        details: { reason: 'Already booked' },
      });

      // Execute function
      await BranchSocket.handleFieldAvailabilityCheck(mockSocket, mockData);

      // Assertions
      expect(validateBookingTime).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('field:availability-error', expect.objectContaining({
        message: 'Field not available',
        details: { reason: 'Already booked' },
      }));
    });
  });

  describe('handleBookingStats', () => {
    it('seharusnya mengembalikan statistik booking', async () => {
      // Setup authenticated socket
      mockSocket.data.authenticated = true;
      mockSocket.data.user = { id: 1, role: 'admin' };

      // Mock data
      const mockData = {
        branchId: '1',
      };

      // Mock database response
      (prisma.booking.count as jest.Mock).mockResolvedValueOnce(5);
      (prisma.booking.count as jest.Mock).mockResolvedValueOnce(2);

      // Execute function
      await BranchSocket.handleBookingStats(mockSocket, mockData);

      // Assertions
      expect(prisma.booking.count).toHaveBeenCalledTimes(2);
      expect(mockSocket.emit).toHaveBeenCalledWith('booking:stats-results', {
        todayBookings: 5,
        pendingPayments: 2,
      });
    });

    it('seharusnya mengembalikan error jika pengguna tidak terautentikasi', async () => {
      // Setup unauthenticated socket
      mockSocket.data.authenticated = false;
      mockSocket.data.user = null;

      // Mock data
      const mockData = {
        branchId: '1',
      };

      // Execute function
      await BranchSocket.handleBookingStats(mockSocket, mockData);

      // Assertions
      expect(prisma.booking.count).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('auth:required', expect.any(Object));
    });
  });

  describe('handleCreateManualBooking', () => {
    it('seharusnya membuat booking manual', async () => {
      // Setup authenticated socket
      mockSocket.data.authenticated = true;
      mockSocket.data.user = { id: 1, role: 'admin' };

      // Mock data
      const mockData = {
        fieldId: '1',
        userId: '2',
        bookingDate: '2023-05-01',
        startTime: '2023-05-01T10:00:00',
        endTime: '2023-05-01T12:00:00',
        paymentStatus: 'paid',
        branchId: '3',
      };

      // Mock field
      const mockField = {
        id: 1,
        name: 'Field 1',
        priceDay: 100000,
      };

      // Mock booking and payment
      const mockBooking = { id: 1 };
      const mockCompleteBooking = {
        id: 1,
        field: { name: 'Field 1' },
        user: { name: 'User 1' },
      };

      // Mock function responses
      (verifyFieldBranch as jest.Mock).mockResolvedValue(mockField);
      (validateBookingTime as jest.Mock).mockResolvedValue({ valid: true });
      (createBookingWithPayment as jest.Mock).mockResolvedValue({
        booking: mockBooking,
      });
      (getCompleteBooking as jest.Mock).mockResolvedValue(mockCompleteBooking);

      // Execute function
      await BranchSocket.handleCreateManualBooking(mockSocket, mockData);

      // Assertions
      expect(verifyFieldBranch).toHaveBeenCalledWith(1, 3);
      expect(validateBookingTime).toHaveBeenCalled();
      expect(createBookingWithPayment).toHaveBeenCalled();
      expect(getCompleteBooking).toHaveBeenCalledWith(1);
      expect(mockSocket.emit).toHaveBeenCalledWith('booking:create-success', mockCompleteBooking);
      expect(emitBookingEvents).toHaveBeenCalledWith('new-booking', expect.any(Object));
    });

    it('seharusnya mengembalikan error jika lapangan tidak ditemukan', async () => {
      // Setup authenticated socket
      mockSocket.data.authenticated = true;
      mockSocket.data.user = { id: 1, role: 'admin' };

      // Mock data
      const mockData = {
        fieldId: '1',
        userId: '2',
        bookingDate: '2023-05-01',
        startTime: '2023-05-01T10:00:00',
        endTime: '2023-05-01T12:00:00',
        branchId: '3',
      };

      // Mock field not found
      (verifyFieldBranch as jest.Mock).mockResolvedValue(null);

      // Execute function
      await BranchSocket.handleCreateManualBooking(mockSocket, mockData);

      // Assertions
      expect(verifyFieldBranch).toHaveBeenCalledWith(1, 3);
      expect(validateBookingTime).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('booking:create-error', expect.objectContaining({
        message: 'Field not found in this branch',
      }));
    });
  });

  describe('handleAuthentication', () => {
    it('seharusnya mengautentikasi pengguna dengan token valid', async () => {
      // Mock data
      const mockData = {
        token: 'valid-token',
      };

      // Mock user
      const mockUser = {
        id: 1,
        name: 'Admin User',
        role: 'admin',
        branchId: 2,
      };

      // Mock auth middleware
      (authMiddleware as jest.Mock).mockResolvedValue(mockUser);

      // Execute function
      await BranchSocket.handleAuthentication(mockSocket, mockData, mockCallback);

      // Assertions
      expect(authMiddleware).toHaveBeenCalledWith('valid-token');
      expect(mockSocket.data.user).toEqual(mockUser);
      expect(mockSocket.data.authenticated).toBe(true);
      expect(mockSocket.join).toHaveBeenCalledWith('branch-2');
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        user: expect.objectContaining({
          id: 1,
          name: 'Admin User',
          role: 'admin',
          branchId: 2,
        }),
      });
    });

    it('seharusnya mengembalikan error jika token tidak valid', async () => {
      // Mock data
      const mockData = {
        token: 'invalid-token',
      };

      // Mock auth middleware
      (authMiddleware as jest.Mock).mockResolvedValue(null);

      // Execute function
      await BranchSocket.handleAuthentication(mockSocket, mockData, mockCallback);

      // Assertions
      expect(authMiddleware).toHaveBeenCalledWith('invalid-token');
      expect(mockSocket.data.user).toBeNull();
      expect(mockSocket.data.authenticated).toBe(false);
      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
      });
    });

    it('seharusnya mengembalikan error jika token tidak disediakan', async () => {
      // Mock data without token
      const mockData = {};

      // Execute function
      await BranchSocket.handleAuthentication(mockSocket, mockData, mockCallback);

      // Assertions
      expect(authMiddleware).not.toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Token is required',
      });
    });
  });

  describe('setupBranchSocketHandlers', () => {
    it('seharusnya mengatur socket handlers untuk branch namespace', () => {
      // Setup mock namespaces and event handlers
      const mockNamespace = {
        use: jest.fn((middleware) => middleware),
        on: jest.fn(),
      };
      mockIO.of.mockReturnValue(mockNamespace);

      // Execute function
      BranchSocket.setupBranchSocketHandlers();

      // Assertions
      expect(mockIO.of).toHaveBeenCalledWith('/branches');
      expect(mockNamespace.use).toHaveBeenCalled();
      expect(mockNamespace.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });
}); 