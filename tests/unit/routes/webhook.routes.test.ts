// @ts-nocheck
import { jest, describe, it, expect } from '@jest/globals';

// Mock the controller
jest.mock('../../../src/controllers/webhook/midtrans.controller', () => ({
  handleMidtransNotification: jest.fn()
}));

// Import after mocks
import webhookRoutes from '../../../src/routes/route-lists/webhook.routes';

describe('Webhook Routes', () => {
  it('should export a router', () => {
    expect(webhookRoutes).toBeDefined();
  });
}); 