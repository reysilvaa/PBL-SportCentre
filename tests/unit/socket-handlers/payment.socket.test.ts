import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Socket } from 'socket.io';

// Mock dependencies
jest.mock('../../../src/config/server/socket', () => ({
  getIO: jest.fn(() => ({
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
    of: jest.fn(() => ({
      on: jest.fn(),
      emit: jest.fn(),
    })),
  })),
  applyAuthMiddleware: jest.fn(),
  setupNamespaceEvents: jest.fn(),
}));

// Import the module after mocking dependencies
import * as PaymentSocket from '../../../src/socket-handlers/payment.socket';
import { getIO } from '../../../src/config/server/socket';

describe('Payment Socket Handlers', () => {
  let mockSocket: any;
  let mockIO: any;
  let mockToEmit: jest.Mock;
  let mockOfEmit: jest.Mock;
  let mockBroadcastEmit: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock functions
    mockToEmit = jest.fn();
    mockOfEmit = jest.fn();
    mockBroadcastEmit = jest.fn();

    // Create mock socket
    mockSocket = {
      id: 'socket-id-123',
      emit: jest.fn(),
      broadcast: {
        emit: mockBroadcastEmit,
      },
    } as unknown as Socket;

    // Setup mock IO
    mockIO = {
      to: jest.fn(() => ({
        emit: mockToEmit,
      })),
      of: jest.fn(() => ({
        on: jest.fn(),
        emit: mockOfEmit,
      })),
    };
    (getIO as jest.Mock).mockReturnValue(mockIO);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handlePaymentStatusUpdate', () => {
    it('seharusnya broadcast perubahan status pembayaran', () => {
      // Mock data
      const mockData = {
        paymentId: 1,
        bookingId: 2,
        status: 'paid',
        userId: 3,
      };

      // Execute function
      PaymentSocket.handlePaymentStatusUpdate(mockSocket, mockData);

      // Assertions
      expect(mockBroadcastEmit).toHaveBeenCalledWith('status_change', mockData);
      expect(mockIO.to).toHaveBeenCalledWith('user_3');
      expect(mockToEmit).toHaveBeenCalledWith('payment_update', {
        paymentId: 1,
        bookingId: 2,
        status: 'paid',
        message: 'Your payment status is now paid',
      });
    });

    it('seharusnya hanya broadcast ke room publik jika userId tidak disediakan', () => {
      // Mock data without userId
      const mockData = {
        paymentId: 1,
        bookingId: 2,
        status: 'paid',
      };

      // Execute function
      PaymentSocket.handlePaymentStatusUpdate(mockSocket, mockData);

      // Assertions
      expect(mockBroadcastEmit).toHaveBeenCalledWith('status_change', mockData);
      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });

  describe('sendPaymentNotification', () => {
    it('seharusnya mengirim notifikasi pembayaran kepada pengguna dan admin', () => {
      // Mock data
      const mockData = {
        paymentId: 1,
        bookingId: 2,
        status: 'paid',
        userId: 3,
      };

      // Execute function
      PaymentSocket.sendPaymentNotification(mockData);

      // Assertions
      expect(mockIO.to).toHaveBeenCalledWith('user_3');
      expect(mockToEmit).toHaveBeenCalledWith('payment_update', {
        paymentId: 1,
        bookingId: 2,
        status: 'paid',
        message: 'Your payment status is now paid',
      });
      expect(mockIO.of).toHaveBeenCalledWith('/payments');
      expect(mockOfEmit).toHaveBeenCalledWith('status_change', mockData);
    });

    it('seharusnya menangani ketika Socket.IO belum diinisialisasi', () => {
      // Mock data
      const mockData = {
        paymentId: 1,
        bookingId: 2,
        status: 'paid',
        userId: 3,
      };

      // Mock IO as null
      (getIO as jest.Mock).mockReturnValue(null);

      // Execute function (should not throw)
      PaymentSocket.sendPaymentNotification(mockData);

      // Assertions
      expect(mockIO.to).not.toHaveBeenCalled();
      expect(mockIO.of).not.toHaveBeenCalled();
    });
  });

  describe('setupPaymentSocketHandlers', () => {
    it('seharusnya mengatur payment socket handlers', () => {
      // Setup mock namespaces and event handlers
      const mockOn = jest.fn();
      const mockNamespace = {
        on: mockOn,
      };
      mockIO.of.mockReturnValue(mockNamespace);

      // Execute function
      PaymentSocket.setupPaymentSocketHandlers();

      // Assertions
      expect(mockIO.of).toHaveBeenCalledWith('/payments');
      expect(mockNamespace.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });
}); 