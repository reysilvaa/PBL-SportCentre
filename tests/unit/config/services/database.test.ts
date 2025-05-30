// @ts-nocheck
import { jest, describe, it, expect } from '@jest/globals';

// Mock the PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    // Mock common Prisma methods if needed
    $connect: jest.fn(),
    $disconnect: jest.fn()
  }))
}));

// Import the Prisma instance
import prisma, { prisma as namedPrisma } from '../../../../src/config/services/database';

describe('Database Service', () => {
  it('should export a singleton instance of PrismaClient', () => {
    // Check that the Prisma client is defined
    expect(prisma).toBeDefined();
    
    // Check that it's an instance of PrismaClient (mock)
    expect(prisma.$connect).toBeDefined();
    expect(prisma.$disconnect).toBeDefined();
  });
  
  it('should export the same instance as both default and named export', () => {
    // Check that default and named exports are the same object
    expect(prisma).toBe(namedPrisma);
  });
}); 