// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock the cloudinary module
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
  }
}));

// Mock configuration file
jest.mock('../../../../src/config/app/env', () => ({
  config: {
    cloudinary: {
      cloudName: 'test-cloud-name',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret'
    }
  }
}));

// Mock console functions
console.info = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();
console.log = jest.fn();

// Import the cloudinary module and initialization function
import cloudinary, { initializeCloudinary } from '../../../../src/config/services/cloudinary';

describe('Cloudinary Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize cloudinary with correct configuration', () => {
    // Call the initialization function
    initializeCloudinary();
    
    // Check if cloudinary.config was called with the correct parameters
    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'test-cloud-name',
      api_key: 'test-api-key',
      api_secret: 'test-api-secret',
      secure: true,
    });
  });

  it('should export cloudinary v2', () => {
    // This is a simple test to ensure we're exporting cloudinary.v2
    expect(cloudinary).toBeDefined();
  });
}); 