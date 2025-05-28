import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.mock('../../../src/config/server/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
    of: jest.fn(() => ({
      emit: jest.fn(),
    })),
    emit: jest.fn(),
  })),
}));

jest.mock('../../../src/config/services/database', () => ({
  __esModule: true,
  default: {
    activityLog: {
      create: jest.fn().mockResolvedValue({} as any),
    },
  },
}));

jest.mock('../../../src/socket-handlers/activityLog.socket', () => ({
  broadcastActivityLogUpdates: jest.fn(),
}));

jest.mock('../../../src/utils/variables/timezone.utils', () => ({
  formatDateToWIB: jest.fn((date) => date ? date.toString() : ''),
}));

// Import the module after mocking dependencies
import * as BookingSocket from '../../../src/socket-handlers/booking.socket';
import { getIO } from '../../../src/config/server/socket';
import { formatDateToWIB } from '../../../src/utils/variables/timezone.utils';

describe('Booking Socket Handlers', () => {
  let mockIO: any;
  let mockEmit: jest.Mock;
  let mockToEmit: jest.Mock;
  let mockOfEmit: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup more specific mocks for better control
    mockEmit = jest.fn();
    mockToEmit = jest.fn();
    mockOfEmit = jest.fn();
    
    // Setup mock IO
    mockIO = {
      to: jest.fn(() => ({
        emit: mockToEmit,
      })),
      of: jest.fn(() => ({
        emit: mockOfEmit,
      })),
      emit: mockEmit,
    };
    (getIO as jest.Mock).mockReturnValue(mockIO);
    
    // Setup format date mock
    (formatDateToWIB as jest.Mock).mockImplementation((date) => date ? date.toString() : '');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('emitBookingEvents', () => {
    it('seharusnya menangani event booking:created', () => {
      // Mock data
      const mockData = {
        booking: {
          id: 1,
          userId: 2,
          fieldId: 3,
          bookingDate: new Date('2023-05-01'),
          startTime: new Date('2023-05-01T03:00:00'),
          endTime: new Date('2023-05-01T05:00:00'),
          field: {
            branchId: 4,
          },
        },
      };

      // Execute function
      BookingSocket.emitBookingEvents('booking:created', mockData);

      // Assertions
      expect(mockIO.to).toHaveBeenCalledWith('branch-4');
      expect(mockToEmit).toHaveBeenCalledWith('booking:created', mockData.booking);
      
      expect(mockIO.to).toHaveBeenCalledWith('user-2');
      expect(mockToEmit).toHaveBeenCalledWith('booking:created', expect.objectContaining({
        booking: mockData.booking,
        message: expect.any(String),
      }));
      
      expect(mockIO.to).toHaveBeenCalledWith('field-3');
      expect(mockToEmit).toHaveBeenCalledWith('field:availability-changed', expect.objectContaining({
        fieldId: 3,
        date: mockData.booking.bookingDate,
      }));
    });

    it('seharusnya menangani event update-payment', () => {
      // Mock data
      const mockData = {
        userId: 1,
        branchId: 2,
        booking: {
          id: 3,
        },
        paymentStatus: 'paid',
      };

      // Execute function
      BookingSocket.emitBookingEvents('update-payment', mockData);

      // Assertions
      expect(mockIO.to).toHaveBeenCalledWith('branch-2');
      expect(mockToEmit).toHaveBeenCalledWith('booking:updated', mockData.booking);
      
      expect(mockIO.to).toHaveBeenCalledWith('user-1');
      expect(mockToEmit).toHaveBeenCalledWith('booking:updated', expect.objectContaining({
        bookingId: 3,
        paymentStatus: 'paid',
      }));
    });

    it('seharusnya menangani event booking:cancelled', () => {
      // Mock data
      const mockData = {
        bookingId: 1,
        fieldId: 2,
        userId: 3,
        bookingDate: new Date('2023-05-01'),
        startTime: new Date('2023-05-01T10:00:00'),
        endTime: new Date('2023-05-01T12:00:00'),
      };

      // Execute function
      BookingSocket.emitBookingEvents('booking:cancelled', mockData);

      // Assertions
      expect(mockIO.of).toHaveBeenCalledWith('/admin/bookings');
      expect(mockOfEmit).toHaveBeenCalledWith('booking-canceled', expect.objectContaining({
        bookingId: 1,
        fieldId: 2,
        userId: 3,
      }));
      
      expect(mockIO.of).toHaveBeenCalledWith('/fields');
      expect(mockOfEmit).toHaveBeenCalledWith('availability-update', expect.objectContaining({
        fieldId: 2,
        date: mockData.bookingDate,
      }));
    });

    it('seharusnya menangani event booking:deleted (sama seperti cancelled)', () => {
      // Mock data
      const mockData = {
        bookingId: 1,
        fieldId: 2,
        userId: 3,
        bookingDate: new Date('2023-05-01'),
        startTime: new Date('2023-05-01T10:00:00'),
        endTime: new Date('2023-05-01T12:00:00'),
      };

      // Execute function
      BookingSocket.emitBookingEvents('booking:deleted', mockData);

      // Assertions
      expect(mockIO.of).toHaveBeenCalledWith('/admin/bookings');
      expect(mockOfEmit).toHaveBeenCalledWith('booking-canceled', {
        bookingId: 1,
        fieldId: 2,
        userId: 3,
      });
    });

    it('seharusnya menangani event type yang tidak dikenali', () => {
      // Mock data
      const mockData = { someData: 'test' };

      // Execute function
      BookingSocket.emitBookingEvents('unknown-event', mockData);

      // Assertions
      expect(mockEmit).toHaveBeenCalledWith('unknown-event', mockData);
    });

    it('seharusnya menangani error', () => {
      // Mock IO to throw an error
      mockIO.to.mockImplementation(() => {
        throw new Error('Socket error');
      });

      // Execute function (should not throw)
      BookingSocket.emitBookingEvents('update-payment', { userId: 1 });

      // No assertions needed - test passes if no exception is thrown
    });
  });
}); 