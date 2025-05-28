
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Socket } from 'socket.io';
import { 
  handleSubscribeActivityLogs, 
  broadcastActivityLogUpdates,
  setupActivityLogSocketHandlers
} from '../../../src/socket-handlers/activityLog.socket';
import { prismaMock } from '../../mocks/prisma.mock';

// Mock untuk socket.io yang lebih baik
const mockSocketIo = {
  to: jest.fn(() => ({
    emit: jest.fn(),
  })),
  emit: jest.fn(),
  on: jest.fn(),
};

// Mock getIO function
jest.mock('../../../src/config/server/socket', () => ({
  getIO: jest.fn(() => mockSocketIo),
}));

describe('ActivityLog Socket Handlers', () => {
  let mockSocket: Partial<Socket>;

  beforeEach(() => {
    // Setup mock socket
    mockSocket = {
      id: 'socket-id-123',
      join: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      data: {},
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('handleSubscribeActivityLogs', () => {
    it('seharusnya menambahkan socket ke room pengguna jika userId disediakan', async () => {
      // Arrange
      const options = { userId: '1' };
      
      prismaMock.activityLog.findMany.mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          action: 'LOGIN',
          details: '{}',
          createdAt: new Date(),
          ipAddress: '127.0.0.1',
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ]);

      // Act
      await handleSubscribeActivityLogs(mockSocket as Socket, options);

      // Assert
      expect(mockSocket.join).toHaveBeenCalledWith('activity_logs_user_1');
      expect(mockSocket.emit).toHaveBeenCalledWith('activity_logs_initial', expect.any(Array));
    });

    it('seharusnya tidak menambahkan socket ke room jika userId tidak disediakan', async () => {
      // Arrange
      const options = {};

      // Act
      await handleSubscribeActivityLogs(mockSocket as Socket, options);

      // Assert
      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('broadcastActivityLogUpdates', () => {
    it('seharusnya broadcast ke room pengguna dan room umum', async () => {
      // Arrange
      const userId = 1;

      prismaMock.activityLog.findMany.mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          action: 'LOGIN',
          details: '{}',
          createdAt: new Date(),
          ipAddress: '127.0.0.1',
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ]);

      prismaMock.activityLog.findMany.mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          action: 'LOGIN',
          details: '{}',
          createdAt: new Date(),
          ipAddress: '127.0.0.1',
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
          },
        },
      ]);

      // Act
      await broadcastActivityLogUpdates(userId);

      // Assert
      const { getIO } = require('../../../src/config/server/socket');
      expect(getIO).toHaveBeenCalled();
      const io = getIO();
      expect(io.to).toHaveBeenCalledWith(`activity_logs_user_${userId}`);
      expect(io.to).toHaveBeenCalledWith(`user_${userId}`);
      expect(io.to).toHaveBeenCalledWith('activity_logs_all');
    });
  });

  describe('setupActivityLogSocketHandlers', () => {
    it('seharusnya mengatur listener untuk koneksi socket', () => {
      // Act
      setupActivityLogSocketHandlers();

      // Assert
      const { getIO } = require('../../../src/config/server/socket');
      expect(getIO).toHaveBeenCalled();
      expect(mockSocketIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });
}); 