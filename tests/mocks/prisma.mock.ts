import { PrismaClient } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';
import { jest } from '@jest/globals';

// Create mock prisma client
export const prismaMock = mockDeep<PrismaClient>();

// Konfigurasi mock untuk Prisma
jest.mock('../../src/config/services/database', () => ({
  __esModule: true,
  default: prismaMock
})); 