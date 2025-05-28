import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { integrationTestSetup } from '../core';

// Setup untuk pengujian integrasi
const { requestWithAuth, prismaMock, mockTokens } = integrationTestSetup.setupIntegrationTest();

describe('Booking API Integration Tests', () => {
  beforeAll(async () => {
    // Setup khusus untuk pengujian booking
  });
  
  afterAll(async () => {
    // Cleanup setelah pengujian booking
  });

  describe('POST /api/bookings', () => {
    it('seharusnya membuat booking baru dengan sukses', async () => {
      // Setup
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);
      
      const newBooking = {
        userId: 2,
        fieldId: 1,
        bookingDate: tomorrow.toISOString().split('T')[0],
        startTime: '14:00',
        endTime: '16:00',
      };
      
      // Mock database responses
      prismaMock.field.findUnique.mockResolvedValueOnce({
        id: 1,
        name: 'Lapangan Futsal',
        branchId: 1,
        typeId: 1,
        priceDay: 100000,
        priceNight: 150000,
        status: 'available',
        createdAt: new Date(),
        updatedAt: new Date(),
        branch: {
          id: 1,
          name: 'Cabang Utama'
        }
      } as any);
      
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'Test User',
        email: 'test@example.com',
        phone: '081234567890'
      } as any);
      
      prismaMock.booking.findMany.mockResolvedValueOnce([]);
      
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          return callback(prismaMock);
        }
        return callback;
      });
      
      prismaMock.booking.create.mockResolvedValueOnce({
        id: 100,
        userId: 2,
        fieldId: 1,
        bookingDate: new Date(tomorrow),
        startTime: new Date(tomorrow.setHours(14, 0)),
        endTime: new Date(tomorrow.setHours(16, 0)),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      
      prismaMock.payment.create.mockResolvedValueOnce({
        id: 50,
        bookingId: 100,
        amount: 150000,
        method: 'midtrans',
        status: 'pending',
        transactionId: null,
        paymentUrl: null,
        createdAt: new Date(),
      } as any);
      
      prismaMock.payment.update.mockResolvedValueOnce({
        id: 50,
        bookingId: 100,
        amount: 150000,
        method: 'midtrans',
        status: 'pending',
        transactionId: 'tx-123',
        paymentUrl: 'https://midtrans.com/pay',
        createdAt: new Date(),
      } as any);
      
      // Mock midtrans response
      global.fetch = jest.fn().mockResolvedValueOnce({
        json: jest.fn().mockResolvedValueOnce({
          token: 'mock-token',
          redirect_url: 'https://midtrans.com/payment/mock'
        })
      } as any);
      
      // Execute
      const response = await requestWithAuth('post', '/api/bookings', mockTokens.validUserToken, newBooking);
      
      // Verify
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('booking');
      expect(response.body.booking).toHaveProperty('id');
      expect(response.body.booking).toHaveProperty('fieldId', 1);
    });
    
    it('seharusnya menolak booking pada waktu yang bentrok', async () => {
      // Setup
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(16, 0, 0, 0);
      
      const conflictBooking = {
        userId: 2,
        fieldId: 1,
        bookingDate: tomorrow.toISOString().split('T')[0],
        startTime: '16:00',
        endTime: '18:00',
      };
      
      // Mock existing booking with conflicting time
      prismaMock.field.findUnique.mockResolvedValueOnce({
        id: 1,
        name: 'Lapangan Futsal',
        branchId: 1,
        typeId: 1,
        priceDay: 100000,
        priceNight: 150000,
        status: 'available',
        createdAt: new Date(),
        updatedAt: new Date(),
        branch: {
          id: 1,
          name: 'Cabang Utama'
        }
      } as any);
      
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 2,
        name: 'Test User',
        email: 'test@example.com',
        phone: '081234567890'
      } as any);
      
      // Mock isFieldAvailable to return false for conflict
      prismaMock.booking.findMany.mockResolvedValueOnce([{
        id: 99,
        userId: 3,
        fieldId: 1,
        bookingDate: new Date(conflictBooking.bookingDate),
        startTime: new Date(tomorrow.setHours(16, 0)),
        endTime: new Date(tomorrow.setHours(18, 0)),
        status: 'confirmed',
      }] as any);
      
      // Execute
      const response = await requestWithAuth('post', '/api/bookings', mockTokens.validUserToken, conflictBooking);
      
      // Verify
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Lapangan sudah dibooking');
    });
  });
  
  describe('GET /api/bookings/users/:userId/bookings', () => {
    it('seharusnya mendapatkan daftar booking pengguna', async () => {
      // Mock user bookings
      prismaMock.booking.findMany.mockResolvedValueOnce([
        {
          id: 100,
          userId: 2,
          fieldId: 1,
          bookingDate: new Date(),
          startTime: new Date(),
          endTime: new Date(),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          field: {
            id: 1,
            name: 'Lapangan Futsal',
            branch: { id: 1, name: 'Cabang Utama' }
          },
          payment: {
            id: 50,
            status: 'pending',
            amount: 150000,
          }
        }
      ] as any);
      
      // Execute
      const response = await requestWithAuth('get', '/api/bookings/users/2/bookings', mockTokens.validUserToken);
      
      // Verify
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('field');
      }
    });
  });
  
  describe('GET /api/bookings/:id/user', () => {
    it('seharusnya mendapatkan detail booking berdasarkan ID', async () => {
      // Mock booking detail
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        id: 100,
        userId: 2,
        fieldId: 1,
        bookingDate: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        field: {
          id: 1,
          name: 'Lapangan Futsal',
          branch: { id: 1, name: 'Cabang Utama' }
        },
        payment: {
          id: 50,
          status: 'pending',
          amount: 150000,
        }
      } as any);
      
      // Execute
      const response = await requestWithAuth('get', '/api/bookings/100/user', mockTokens.validUserToken);
      
      // Verify
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 100);
      expect(response.body).toHaveProperty('fieldId', 1);
    });
    
    it('seharusnya mengembalikan 404 jika booking tidak ditemukan', async () => {
      // Mock non-existing booking
      prismaMock.booking.findUnique.mockResolvedValueOnce(null);
      
      // Execute
      const response = await requestWithAuth('get', '/api/bookings/999/user', mockTokens.validUserToken);
      
      // Verify
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Booking tidak ditemukan');
    });
  });
  
  describe('DELETE /api/bookings/bookings/:id', () => {
    it('seharusnya membatalkan booking yang ada', async () => {
      // Mock booking yang akan dibatalkan
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        id: 100,
        userId: 2,
        fieldId: 1,
        bookingDate: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        field: { id: 1, branchId: 1 },
        payment: {
          id: 50,
          status: 'pending',
        }
      } as any);
      
      prismaMock.payment.delete.mockResolvedValueOnce({} as any);
      prismaMock.booking.delete.mockResolvedValueOnce({} as any);
      
      // Execute
      const response = await requestWithAuth('delete', '/api/bookings/bookings/100', mockTokens.validUserToken);
      
      // Verify
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Booking berhasil dibatalkan');
    });
    
    it('seharusnya menolak pembatalan booking yang sudah selesai', async () => {
      // Mock completed booking
      prismaMock.booking.findUnique.mockResolvedValueOnce({
        id: 101,
        userId: 2,
        fieldId: 1,
        payment: {
          id: 51,
          status: 'PAID',
        },
        field: { id: 1, branchId: 1 }
      } as any);
      
      // Execute
      const response = await requestWithAuth('delete', '/api/bookings/bookings/101', mockTokens.validUserToken);
      
      // Verify
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('tidak dapat dibatalkan');
    });
  });
}); 