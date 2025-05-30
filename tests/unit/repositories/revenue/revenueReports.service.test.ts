import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Decimal } from '@prisma/client/runtime/library';
import * as RevenueService from '../../../../src/repositories/revenue/revenueReports.service';
import { prisma } from '../../../../src/config';

// Mock prisma client
jest.mock('../../../../src/config', () => ({
  prisma: {
    payment: {
      findMany: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    field: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

describe('Revenue Reports Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateRevenueReport', () => {
    it('should generate a daily revenue report', async () => {
      // Arrange
      const start = new Date('2023-01-01');
      const end = new Date('2023-01-31');
      const mockPayments = [
        {
          id: 1,
          amount: new Decimal(100000),
          booking: {
            bookingDate: new Date('2023-01-15'),
            field: { 
              id: 1, 
              name: 'Field 1',
              branch: { id: 1, name: 'Branch 1' }
            }
          }
        },
        {
          id: 2,
          amount: new Decimal(150000),
          booking: {
            bookingDate: new Date('2023-01-15'),
            field: { 
              id: 2, 
              name: 'Field 2',
              branch: { id: 1, name: 'Branch 1' }
            }
          }
        }
      ];

      (prisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      // Act
      const result = await RevenueService.generateRevenueReport(start, end, 'daily');

      // Assert
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: {
          status: 'paid',
          booking: {
            bookingDate: {
              gte: start,
              lte: end,
            },
            field: undefined,
          },
        },
        include: {
          booking: {
            include: {
              field: {
                include: {
                  branch: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      expect(result).toHaveProperty('reportType', 'daily');
      expect(result).toHaveProperty('totalRevenue', 250000);
      expect(result).toHaveProperty('totalBookings', 2);
      expect(result).toHaveProperty('data');
      expect(result.data.length).toBe(1); // Since both are on same day
      expect(result.data[0]).toHaveProperty('total', 250000);
      expect(result.data[0]).toHaveProperty('count', 2);
    });

    it('should generate a report for a specific branch', async () => {
      // Arrange
      const start = new Date('2023-01-01');
      const end = new Date('2023-01-31');
      const branchId = 1;
      const mockPayments = [
        {
          id: 1,
          amount: new Decimal(100000),
          booking: {
            bookingDate: new Date('2023-01-15'),
            field: { 
              id: 1, 
              name: 'Field 1',
              branch: { id: 1, name: 'Branch 1' }
            }
          }
        }
      ];

      (prisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      // Act
      const result = await RevenueService.generateRevenueReport(start, end, 'daily', branchId);

      // Assert
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: {
          status: 'paid',
          booking: {
            bookingDate: {
              gte: start,
              lte: end,
            },
            field: { branchId },
          },
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });

      expect(result).toHaveProperty('totalRevenue', 100000);
    });
  });

  describe('generateOccupancyReport', () => {
    it('should generate an occupancy report', async () => {
      // Arrange
      const start = new Date('2023-01-01');
      const end = new Date('2023-01-31');
      const mockBookings = [
        {
          id: 1,
          fieldId: 1,
          bookingDate: new Date('2023-01-15'),
          startTime: new Date('2023-01-15T08:00:00'),
          endTime: new Date('2023-01-15T10:00:00'), // 2 hours
          field: { 
            id: 1, 
            name: 'Field 1',
            branch: { id: 1, name: 'Branch 1' }
          }
        },
        {
          id: 2,
          fieldId: 1,
          bookingDate: new Date('2023-01-16'),
          startTime: new Date('2023-01-16T14:00:00'),
          endTime: new Date('2023-01-16T16:00:00'), // 2 hours
          field: { 
            id: 1, 
            name: 'Field 1',
            branch: { id: 1, name: 'Branch 1' }
          }
        }
      ];

      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);

      // Act
      const result = await RevenueService.generateOccupancyReport(start, end);

      // Assert
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          bookingDate: {
            gte: start,
            lte: end,
          },
          field: undefined,
        },
        include: {
          field: {
            include: {
              branch: true,
            },
          },
        },
        orderBy: {
          bookingDate: 'asc',
        },
      });

      expect(result).toHaveProperty('totalBookings', 2);
      expect(result).toHaveProperty('totalHours', 4);
      expect(result).toHaveProperty('averageHoursPerBooking', 2);
      expect(result).toHaveProperty('data');
      expect(result.data.length).toBe(1); // Only one field
      expect(result.data[0]).toHaveProperty('fieldName', 'Field 1');
      expect(result.data[0]).toHaveProperty('totalBookings', 2);
      expect(result.data[0]).toHaveProperty('totalHours', 4);
    });
  });

  describe('generateBusinessPerformanceReport', () => {
    it('should generate a business performance report', async () => {
      // Arrange
      const mockPayments = [
        {
          id: 1,
          amount: new Decimal(100000),
          status: 'paid',
          booking: { id: 1 }
        }
      ];

      const mockPopularFields = [
        { fieldId: 1, _count: { id: 10 } }
      ];

      const mockFields = [
        { id: 1, name: 'Field 1', branch: { id: 1, name: 'Branch 1' } }
      ];

      (prisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);
      (prisma.booking.groupBy as jest.Mock).mockResolvedValue(mockPopularFields);
      (prisma.field.findMany as jest.Mock).mockResolvedValue(mockFields);

      // Act
      const result = await RevenueService.generateBusinessPerformanceReport();

      // Assert
      expect(result).toHaveProperty('revenueData');
      expect(result).toHaveProperty('bookingData');
      expect(result).toHaveProperty('topFields');
      expect(result.topFields.length).toBe(1);
      expect(result.topFields[0]).toHaveProperty('fieldName', 'Field 1');
      expect(result.topFields[0]).toHaveProperty('bookingCount', 10);
    });
  });

  describe('generateBookingForecast', () => {
    it('should generate a booking forecast report', async () => {
      // Arrange
      const mockBookings = [
        {
          id: 1,
          bookingDate: new Date('2023-01-15'),
          field: { id: 1, name: 'Field 1' }
        },
        {
          id: 2,
          bookingDate: new Date('2023-02-15'),
          field: { id: 1, name: 'Field 1' }
        }
      ];

      const mockTrendingFields = [
        { fieldId: 1, _count: { id: 10 } }
      ];

      const mockFields = [
        { id: 1, name: 'Field 1', branch: { id: 1, name: 'Branch 1' } }
      ];

      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.groupBy as jest.Mock).mockResolvedValue(mockTrendingFields);
      (prisma.field.findMany as jest.Mock).mockResolvedValue(mockFields);

      // Act
      const result = await RevenueService.generateBookingForecast();

      // Assert
      expect(result).toHaveProperty('bookingTrend');
      expect(result).toHaveProperty('trendingFields');
      expect(result.trendingFields.length).toBe(1);
      expect(result.trendingFields[0]).toHaveProperty('name', 'Field 1');
      expect(result.bookingTrend.length).toBeGreaterThan(0);
    });
  });
}); 