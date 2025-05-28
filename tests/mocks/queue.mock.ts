import { jest } from '@jest/globals';
import { NAMESPACE } from './redis.mock';

// Mock Queue instance
const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  process: jest.fn(),
  on: jest.fn(),
};

// Mock Queue class constructor
const mockQueueConstructor = jest.fn(() => mockQueue);

// Mock untuk fungsi-fungsi utama Queue
jest.mock('bull', () => mockQueueConstructor);

// Mock untuk konfigurasi Queue
jest.mock('../../src/config/services/queue', () => {
  return {
    queueConfig: {
      redis: {
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: 5
      },
      prefix: NAMESPACE.PREFIX || 'sportcenter',
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: true
      }
    },
    createQueue: jest.fn(() => mockQueue),
    setupQueueProcessor: jest.fn(),
  };
}); 