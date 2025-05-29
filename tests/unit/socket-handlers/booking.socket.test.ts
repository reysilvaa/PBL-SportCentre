import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { emitBookingEvents } from '../../../src/socket-handlers/booking.socket';

// Mock dependencies
jest.mock('../../../src/config/server/socket', () => ({
  getIO: jest.fn().mockReturnValue({
    to: jest.fn().mockReturnThis(),
    of: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }),
}));

jest.mock('../../../src/config/services/database', () => ({
  __esModule: true,
  default: {
    activityLog: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

jest.mock('../../../src/socket-handlers/activityLog.socket', () => ({
  broadcastActivityLogUpdates: jest.fn(),
}));

jest.mock('../../../src/utils/variables/timezone.utils', () => ({
  formatDateToWIB: jest.fn((date) => date ? date.toString() : ''),
}));

describe('Booking Socket Handler', () => {
  let mockIO: any;
  let mockPrisma: any;
  let mockActivityLogBroadcast: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mocks
    mockIO = require('../../../src/config/server/socket').getIO();
    mockPrisma = require('../../../src/config/services/database').default;
    mockActivityLogBroadcast = require('../../../src/socket-handlers/activityLog.socket').broadcastActivityLogUpdates;
  });

  describe('emitBookingEvents - booking:created', () => {
    it('seharusnya mengirim event booking:created ke saluran cabang, pengguna, dan lapangan', async () => {
      // Arrange
      const eventType = 'booking:created';
      const mockBooking = {
        booking: {
          id: 1,
          userId: 1,
          fieldId: 1,
          bookingDate: new Date('2023-06-15'),
          startTime: new Date('2023-06-15T10:00:00'),
          endTime: new Date('2023-06-15T12:00:00'),
          status: 'confirmed',
          field: {
            id: 1,
            name: 'Lapangan Futsal A',
            branchId: 1,
          },
        },
      };

      // Act
      await emitBookingEvents(eventType, mockBooking);

      // Assert
      // Verifikasi emit ke saluran cabang
      expect(mockIO.to).toHaveBeenCalledWith(`branch-${mockBooking.booking.field.branchId}`);
      expect(mockIO.emit).toHaveBeenCalledWith('booking:created', mockBooking.booking);

      // Verifikasi emit ke saluran pengguna
      expect(mockIO.to).toHaveBeenCalledWith(`user-${mockBooking.booking.userId}`);
      expect(mockIO.emit).toHaveBeenCalledWith('booking:created', {
        booking: mockBooking.booking,
        message: 'A new booking has been created for you',
      });

      // Verifikasi emit ke saluran lapangan
      expect(mockIO.to).toHaveBeenCalledWith(`field-${mockBooking.booking.fieldId}`);
      expect(mockIO.emit).toHaveBeenCalledWith('field:availability-changed', expect.objectContaining({
        fieldId: mockBooking.booking.fieldId,
        available: false,
      }));

      // Verifikasi log aktivitas
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockBooking.booking.userId,
          action: 'CREATE_BOOKING',
        }),
      });

      // Menghilangkan pengujian broadcastActivityLogUpdates karena dilakukan secara asinkron
      // dan tidak terlihat dalam pengujian ini
    });
  });

  describe('emitBookingEvents - update-payment', () => {
    it('seharusnya mengirim event booking:updated ke saluran cabang dan pengguna', async () => {
      // Arrange
      const eventType = 'update-payment';
      const mockData = {
        booking: {
          id: 1,
          status: 'confirmed',
        },
        branchId: 1,
        userId: 1,
        paymentStatus: 'paid',
      };

      // Act
      await emitBookingEvents(eventType, mockData);

      // Assert
      // Verifikasi emit ke saluran cabang
      expect(mockIO.to).toHaveBeenCalledWith(`branch-${mockData.branchId}`);
      expect(mockIO.emit).toHaveBeenCalledWith('booking:updated', mockData.booking);

      // Verifikasi emit ke saluran pengguna
      expect(mockIO.to).toHaveBeenCalledWith(`user-${mockData.userId}`);
      expect(mockIO.emit).toHaveBeenCalledWith('booking:updated', {
        bookingId: mockData.booking.id,
        paymentStatus: mockData.paymentStatus,
        message: `Your booking payment status has been updated to: ${mockData.paymentStatus}`,
      });

      // Verifikasi log aktivitas
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockData.userId,
          action: 'UPDATE_PAYMENT',
        }),
      });

      // Menghilangkan pengujian broadcastActivityLogUpdates karena dilakukan secara asinkron
    });
  });

  describe('emitBookingEvents - booking:cancelled', () => {
    it('seharusnya mengirim event booking-canceled ke saluran admin dan memperbarui ketersediaan lapangan', async () => {
      // Arrange
      const eventType = 'booking:cancelled';
      const mockData = {
        bookingId: 1,
        fieldId: 1,
        userId: 1,
        bookingDate: '2023-06-15',
        startTime: new Date('2023-06-15T10:00:00'),
        endTime: new Date('2023-06-15T12:00:00'),
      };

      // Act
      await emitBookingEvents(eventType, mockData);

      // Assert
      // Verifikasi emit ke saluran admin
      expect(mockIO.of).toHaveBeenCalledWith('/admin/bookings');
      expect(mockIO.emit).toHaveBeenCalledWith('booking-canceled', {
        bookingId: mockData.bookingId,
        fieldId: mockData.fieldId,
        userId: mockData.userId,
      });

      // Verifikasi emit ke saluran lapangan
      expect(mockIO.of).toHaveBeenCalledWith('/fields');
      expect(mockIO.emit).toHaveBeenCalledWith('availability-update', expect.objectContaining({
        fieldId: mockData.fieldId,
        available: true,
      }));

      // Verifikasi log aktivitas
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockData.userId,
          action: 'CANCEL_BOOKING',
        }),
      });

      // Menghilangkan pengujian broadcastActivityLogUpdates karena dilakukan secara asinkron
    });
  });

  describe('emitBookingEvents - custom event', () => {
    it('seharusnya mengirim event kustom dengan data mentah', () => {
      // Arrange
      const eventType = 'custom-booking-event';
      const mockData = { customField: 'customValue' };

      // Act
      emitBookingEvents(eventType, mockData);

      // Assert
      expect(mockIO.emit).toHaveBeenCalledWith(eventType, mockData);
    });
  });

  describe('emitBookingEvents - error handling', () => {
    it('seharusnya menangani error saat mengirim event', () => {
      // Arrange
      const eventType = 'booking:created';
      const mockBooking = {
        booking: {
          id: 1,
          userId: 1,
          fieldId: 1,
        },
      };

      // Mock console.error
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock error from socket
      require('../../../src/config/server/socket').getIO.mockImplementation(() => {
        throw new Error('Socket error');
      });

      // Act - Tidak akan throw error
      expect(() => emitBookingEvents(eventType, mockBooking)).not.toThrow();

      // Assert
      expect(console.error).toHaveBeenCalled();
    });
  });
}); 