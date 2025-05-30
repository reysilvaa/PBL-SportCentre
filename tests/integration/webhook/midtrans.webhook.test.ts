import { describe, it, expect, jest, beforeEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express, { Application } from 'express';
import { handleMidtransNotification } from '../../../src/controllers/webhook/midtrans.controller';
import prisma from '../../../src/config/services/database';
import { PaymentStatus } from '../../../src/types';

// Mock the database client
jest.mock('../../../src/config/services/database', () => ({
  booking: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  payment: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  field: {
    findUnique: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  },
  notification: {
    create: jest.fn().mockResolvedValue({
      id: 1,
      userId: 1,
      title: 'Payment Success',
      message: 'Your payment has been processed successfully',
      isRead: false,
      type: 'payment',
      linkId: '1',
      createdAt: new Date()
    })
  },
  activityLog: {
    create: jest.fn()
  }
}));

// Mock socket events
jest.mock('../../../src/config/server/socket', () => ({
  emitNotificationToUser: jest.fn(),
  emitBookingEvents: jest.fn()
}));

describe('Midtrans Webhook Integration', () => {
  let app: Application;
  let server: any;
  
  // Mock data
  const mockBooking = {
    id: 1,
    userId: 1,
    fieldId: 1,
    bookingDate: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    field: {
      id: 1,
      name: 'Test Field',
      branchId: 1
    },
    user: {
      id: 1,
      name: 'Test User',
      email: 'test@example.com'
    }
  };
  
  const mockPayment = {
    id: 1,
    bookingId: 1,
    userId: 1,
    amount: 100000,
    paymentMethod: 'midtrans',
    status: PaymentStatus.PENDING,
    transactionId: 'test-transaction-123',
    paymentUrl: 'https://midtrans.com/payment',
    createdAt: new Date()
  };
  
  beforeAll(() => {
    // Setup express app
    app = express();
    app.use(express.json());
    
    // Add the webhook route
    app.post('/webhook/midtrans', handleMidtransNotification);
    
    // Start the server
    server = app.listen(0);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mock behavior
    (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
    (prisma.payment.update as jest.Mock).mockResolvedValue({
      ...mockPayment,
      status: PaymentStatus.PAID
    });
  });
  
  afterAll((done) => {
    if (server) server.close(done);
    else done();
  });
  
  it('should handle settlement notification and update payment status', async () => {
    // Mock notification payload from Midtrans
    const notification = {
      transaction_time: '2023-08-15 10:00:00',
      transaction_status: 'settlement',
      transaction_id: 'test-transaction-123',
      status_message: 'Payment successful',
      status_code: '200',
      signature_key: 'valid-signature',
      payment_type: 'credit_card',
      order_id: '1',
      merchant_id: 'test-merchant',
      gross_amount: '100000.00',
      fraud_status: 'accept',
      currency: 'IDR'
    };
    
    // Make the API request
    const response = await request(app)
      .post('/webhook/midtrans')
      .send(notification)
      .set('Content-Type', 'application/json');
    
    // Assertions
    expect(response.status).toBe(200);
    expect(prisma.payment.findUnique).toHaveBeenCalledWith({
      where: { transactionId: 'test-transaction-123' }
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: PaymentStatus.PAID }
    });
    expect(prisma.notification.create).toHaveBeenCalled();
  });
  
  it('should handle deny notification and update payment status to failed', async () => {
    // Mock notification payload from Midtrans for denied payment
    const notification = {
      transaction_time: '2023-08-15 10:00:00',
      transaction_status: 'deny',
      transaction_id: 'test-transaction-123',
      status_message: 'Payment denied',
      status_code: '202',
      signature_key: 'valid-signature',
      payment_type: 'credit_card',
      order_id: '1',
      merchant_id: 'test-merchant',
      gross_amount: '100000.00',
      fraud_status: 'deny',
      currency: 'IDR'
    };
    
    // Mock payment update to failed
    (prisma.payment.update as jest.Mock).mockResolvedValue({
      ...mockPayment,
      status: PaymentStatus.FAILED
    });
    
    // Make the API request
    const response = await request(app)
      .post('/webhook/midtrans')
      .send(notification)
      .set('Content-Type', 'application/json');
    
    // Assertions
    expect(response.status).toBe(200);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { status: PaymentStatus.FAILED }
      })
    );
  });
  
  it('should return 404 when payment not found', async () => {
    // Mock payment not found
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
    
    // Mock notification payload
    const notification = {
      transaction_time: '2023-08-15 10:00:00',
      transaction_status: 'settlement',
      transaction_id: 'nonexistent-transaction',
      status_message: 'Payment successful',
      status_code: '200',
      signature_key: 'valid-signature',
      payment_type: 'credit_card',
      order_id: '999',
      merchant_id: 'test-merchant',
      gross_amount: '100000.00',
      fraud_status: 'accept',
      currency: 'IDR'
    };
    
    // Make the API request
    const response = await request(app)
      .post('/webhook/midtrans')
      .send(notification)
      .set('Content-Type', 'application/json');
    
    // Assertions
    expect(response.status).toBe(404);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
}); 