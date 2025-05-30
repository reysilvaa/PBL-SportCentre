// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock midtrans-client
jest.mock('midtrans-client', () => ({
  Snap: jest.fn().mockImplementation(function(options) {
    this.options = options;
    return this;
  })
}));

// Mock configuration file
jest.mock('../../../../src/config/app/env', () => ({
  config: {
    isProduction: false,
    midtransServerKey: 'test-server-key',
    midtransClientKey: 'test-client-key'
  }
}));

// Mock console functions
console.info = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();
console.log = jest.fn();

// Import the midtrans function
import { midtrans } from '../../../../src/config/services/midtrans';

describe('Midtrans Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a Midtrans Snap client with correct configuration', () => {
    // Call the midtrans function
    const snapClient = midtrans();
    
    // Check if the Snap client was created with the correct options
    expect(snapClient.options).toEqual({
      isProduction: false,
      serverKey: 'test-server-key',
      clientKey: 'test-client-key',
      apiConfig: {
        timeout: 5000
      }
    });
  });

  it('should export a function that returns a Midtrans Snap client', () => {
    // This is a simple test to ensure we're exporting a function
    expect(typeof midtrans).toBe('function');
    
    // And that the function returns a Snap client
    const snapClient = midtrans();
    expect(snapClient).toBeDefined();
  });
}); 