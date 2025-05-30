import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Decimal } from '@prisma/client/runtime/library';
import * as StatsService from '../../../../src/repositories/statistics/unifiedStats.service';
import prisma from '../../../../src/config/services/database';
import { PaymentStatus } from '../../../../src/types';


// Mock the prisma dependency
jest.mock('../../../../src/config/services/database', () => ({
  user: {
    count: jest.fn(),
    findUnique: jest.fn(),
  },
  branch: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  field: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  promotion: {
    count: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },
  branchAdmin: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  payment: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(prisma)),
}));

describe('Unified Stats Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTimeRange', () => {
    it('should return daily time range', () => {
      // Act
      const result = StatsService.getTimeRange('daily');

      // Assert
      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('end');
      expect(result).toHaveProperty('previous');
      expect(result).toHaveProperty('formatFn');
      expect(result).toHaveProperty('interval', 'hour');
      expect(result).toHaveProperty('pastPeriods', 7);
    });

    it('should return monthly time range by default', () => {
      // Act
      const result = StatsService.getTimeRange('monthly');

      // Assert
      expect(result).toHaveProperty('interval', 'month');
      expect(result).toHaveProperty('pastPeriods', 12);
    });

    it('should return yearly time range', () => {
      // Act
      const result = StatsService.getTimeRange('yearly');

      // Assert
      expect(result).toHaveProperty('interval', 'year');
      expect(result).toHaveProperty('pastPeriods', 6);
    });
  });

  describe('getSuperAdminStats', () => {
    it('should return stats for super admin', async () => {
      // Arrange
      const mockTimeRange = {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      };

      // Mock database responses
      (prisma.branch.count as jest.Mock).mockResolvedValue(5);
      (prisma.user.count as jest.Mock).mockResolvedValue(100);
      (prisma.field.count as jest.Mock).mockResolvedValue(20);
      (prisma.promotion.count as jest.Mock).mockResolvedValue(10);
      
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: 'Branch 1',
          location: 'Jakarta, Indonesia',
          status: 'ACTIVE',
          admins: [{ userId: 1 }, { userId: 2 }],
          Fields: [{ id: 1 }, { id: 2 }],
        },
        {
          id: 2,
          name: 'Branch 2',
          location: 'Bandung, Indonesia',
          status: 'ACTIVE',
          admins: [{ userId: 3 }],
          Fields: [{ id: 3 }],
        },
      ]);

      // Act
      const result = await StatsService.getSuperAdminStats(mockTimeRange);

      // Assert
      expect(result).toHaveProperty('totalBranches', 5);
      expect(result).toHaveProperty('totalUsers', 100);
      expect(result).toHaveProperty('totalFields', 20);
      expect(result).toHaveProperty('activePromotions', 10);
      expect(result).toHaveProperty('regions');
      expect(result).toHaveProperty('branches');
      expect(result.branches.length).toBe(2);
      expect(result.branches[0]).toHaveProperty('name', 'Branch 1');
      expect(result.branches[0]).toHaveProperty('adminCount', 2);
      expect(result.branches[0]).toHaveProperty('fieldCount', 2);
    });
  });

  describe('getSuperAdminStatsWithCharts', () => {
    it('should return stats with chart data for super admin', async () => {
      // Arrange
      const mockTimeRange = {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
        interval: 'month',
      };

      // Mock basic stats
      (prisma.branch.count as jest.Mock).mockResolvedValue(5);
      (prisma.user.count as jest.Mock).mockResolvedValue(100);
      (prisma.field.count as jest.Mock).mockResolvedValue(20);
      (prisma.promotion.count as jest.Mock).mockResolvedValue(10);
      
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: 'Branch 1',
          location: 'Jakarta, Indonesia',
          status: 'ACTIVE',
          admins: [{ userId: 1 }, { userId: 2 }],
          Fields: [{ id: 1 }, { id: 2 }],
        },
      ]);

      // Mock bookings for chart data
      (prisma.booking.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          bookingDate: new Date('2023-01-15'),
          payment: {
            status: 'paid',
            amount: new Decimal(100000),
          },
        },
        {
          id: 2,
          bookingDate: new Date('2023-02-15'),
          payment: {
            status: 'paid',
            amount: new Decimal(150000),
          },
        },
      ]);

      // Act
      const result = await StatsService.getSuperAdminStatsWithCharts(mockTimeRange);

      // Assert
      expect(result).toHaveProperty('totalBranches', 5);
      expect(result).toHaveProperty('totalUsers', 100);
      expect(result).toHaveProperty('totalFields', 20);
      expect(result).toHaveProperty('activePromotions', 10);
      expect(result).toHaveProperty('totalBookings', 2);
      expect(result).toHaveProperty('totalIncome', 250000);
      expect(result).toHaveProperty('revenueData');
      expect(result).toHaveProperty('bookingData');
      expect(result.revenueData).toHaveProperty('categories');
      expect(result.revenueData).toHaveProperty('series');
      expect(result.bookingData).toHaveProperty('categories');
      expect(result.bookingData).toHaveProperty('series');
    });
  });

  describe('getOwnerCabangStats', () => {
    it('should return stats for owner cabang', async () => {
      // Arrange
      const userId = 1;
      const mockTimeRange = {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
        interval: 'month',
        pastPeriods: 12,
      };

      // Mock branches owned by user
      (prisma.branch.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          name: 'Branch 1',
          location: 'Jakarta, Indonesia',
          status: 'ACTIVE',
          Fields: [
            {
              id: 1,
              name: 'Field 1',
              Bookings: [
                {
                  id: 1,
                  bookingDate: new Date('2023-01-15'),
                  payment: {
                    status: 'paid',
                    amount: new Decimal(100000),
                  },
                },
              ],
            },
          ],
        },
      ]);

      // Mock branch admins
      (prisma.branchAdmin.findMany as jest.Mock).mockResolvedValue([
        {
          userId: 2,
          branchId: 1,
          user: {
            id: 2,
            name: 'Admin 1',
            email: 'admin1@example.com',
            role: 'admin_cabang',
            createdAt: new Date(),
          },
          branch: {
            id: 1,
            name: 'Branch 1',
          },
        },
      ]);

      // Act
      const result = await StatsService.getOwnerCabangStats(userId, mockTimeRange);

      // Assert
      expect(result).toHaveProperty('totalBranches', 1);
      expect(result).toHaveProperty('totalAdmins', 1);
      expect(result).toHaveProperty('totalIncome');
      expect(result).toHaveProperty('totalBookings', 1);
      expect(result).toHaveProperty('revenueData');
      expect(result).toHaveProperty('bookingData');
      expect(result).toHaveProperty('branches');
      expect(result).toHaveProperty('admins');
      expect(result.branches.length).toBe(1);
      expect(result.branches[0]).toHaveProperty('name', 'Branch 1');
      expect(result.admins.length).toBe(1);
      expect(result.admins[0]).toHaveProperty('name', 'Admin 1');
    });
  });

  describe('getAdminCabangStats', () => {
    it('should return stats for admin cabang', async () => {
      // Arrange
      const userId = 1;
      const mockTimeRange = {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
        interval: 'month',
        pastPeriods: 12,
      };

      // Mock branch admin relationship
      (prisma.branchAdmin.findFirst as jest.Mock).mockResolvedValue({
        userId: 1,
        branchId: 1,
      });

      // Mock branch data
      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Branch 1',
        Fields: [
          {
            id: 1,
            name: 'Field 1',
            Bookings: [
              {
                id: 1,
                bookingDate: new Date('2023-01-15'),
                startTime: new Date('2023-01-15T08:00:00'),
                endTime: new Date('2023-01-15T10:00:00'),
                payment: {
                  status: PaymentStatus.PAID,
                  amount: new Decimal(100000),
                },
                user: {
                  id: 2,
                  name: 'User 1',
                  email: 'user1@example.com',
                },
              },
              {
                id: 2,
                bookingDate: new Date('2023-01-16'),
                startTime: new Date('2023-01-16T14:00:00'),
                endTime: new Date('2023-01-16T16:00:00'),
                payment: {
                  status: PaymentStatus.PENDING,
                  amount: new Decimal(150000),
                },
                user: {
                  id: 3,
                  name: 'User 2',
                  email: 'user2@example.com',
                },
              },
            ],
          },
          {
            id: 2,
            name: 'Field 2',
            Bookings: [], // No bookings
          },
        ],
      });

      // Act
      const result = await StatsService.getAdminCabangStats(userId, mockTimeRange);

      // Assert
      expect(result).toHaveProperty('totalBookings', 2);
      expect(result).toHaveProperty('pendingPayments', 1);
      expect(result).toHaveProperty('totalIncome', 100000);
      expect(result).toHaveProperty('availableFields', 2); // Field 2 has no bookings
      expect(result).toHaveProperty('bookingData');
      expect(result).toHaveProperty('revenueData');
      expect(result).toHaveProperty('topCustomers');
      expect(result.topCustomers.length).toBe(2);
    });

    it('should throw error if branch admin not found', async () => {
      // Arrange
      const userId = 999;
      const mockTimeRange = {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      };

      // Mock branch admin not found
      (prisma.branchAdmin.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(StatsService.getAdminCabangStats(userId, mockTimeRange))
        .rejects.toThrow('Branch admin not found');
    });
  });

  describe('getUserStats', () => {
    it('should return stats for regular user', async () => {
      // Arrange
      const userId = 1;
      const mockTimeRange = {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      };

      // Set current date to fixed value for consistent test
      const realDate = Date;
      const mockDate = new Date('2023-01-20');
      
      // Use a simpler approach for mocking Date
      const originalDate = global.Date;
      global.Date = jest.fn(() => mockDate) as any;
      global.Date.now = originalDate.now;

      // Mock user data with bookings
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        Bookings: [
          {
            id: 1,
            bookingDate: new Date('2023-01-15'), // Past booking
            field: {
              id: 1,
              name: 'Field 1',
              branch: { id: 1, name: 'Branch 1' },
            },
            payment: {
              status: 'paid',
              amount: new Decimal(100000),
            },
          },
          {
            id: 2,
            bookingDate: new Date('2023-02-15'), // Future booking
            field: {
              id: 1,
              name: 'Field 1',
              branch: { id: 1, name: 'Branch 1' },
            },
            payment: {
              status: 'paid',
              amount: new Decimal(150000),
            },
          },
          {
            id: 3,
            bookingDate: new Date('2023-03-15'), // Future booking
            field: {
              id: 2,
              name: 'Field 2',
              branch: { id: 1, name: 'Branch 1' },
            },
            payment: {
              status: 'pending',
              amount: new Decimal(100000),
            },
          },
        ],
        notifications: [
          { id: 1, isRead: false },
          { id: 2, isRead: false },
        ],
      });

      // Act
      const result = await StatsService.getUserStats(userId, mockTimeRange);

      // Assert
      expect(result).toHaveProperty('activeBookings', 3);
      expect(result).toHaveProperty('completedBookings', 0);
      expect(result).toHaveProperty('favoriteField', 'Field 1');
      expect(result).toHaveProperty('unreadNotifications', 2);
      expect(result).toHaveProperty('activityData');
      expect(result).toHaveProperty('recentBookings');
      expect(result.recentBookings.length).toBe(3);

      // Restore original Date
      global.Date = realDate;
    });

    it('should handle user with no bookings', async () => {
      // Arrange
      const userId = 1;
      const mockTimeRange = {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      };

      // Mock user data with no bookings
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        Bookings: [],
        notifications: [],
      });

      // Act
      const result = await StatsService.getUserStats(userId, mockTimeRange);

      // Assert
      expect(result).toHaveProperty('activeBookings', 0);
      expect(result).toHaveProperty('completedBookings', 0);
      expect(result).toHaveProperty('favoriteField', 'Belum ada');
      expect(result).toHaveProperty('unreadNotifications', 0);
      expect(result).toHaveProperty('activityData');
      expect(result.activityData.series).toEqual(Array(12).fill(0));
      expect(result).toHaveProperty('recentBookings');
      expect(result.recentBookings.length).toBe(0);
    });
  });

  describe('getBookingStats', () => {
    it('should return booking stats for all branches', async () => {
      // Arrange
      (prisma.booking.count as jest.Mock).mockResolvedValue(100);
      
      (prisma.payment.groupBy as jest.Mock).mockResolvedValue([
        { status: 'paid', _count: { id: 70 } },
        { status: 'pending', _count: { id: 30 } },
      ]);
      
      (prisma.booking.groupBy as jest.Mock).mockResolvedValue([
        { bookingDate: new Date('2023-01-15'), _count: { id: 5 } },
        { bookingDate: new Date('2023-01-16'), _count: { id: 7 } },
      ]);
      
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([
        {
          amount: new Decimal(100000),
          booking: {
            field: {
              branch: { id: 1, name: 'Branch 1' },
            },
          },
        },
        {
          amount: new Decimal(150000),
          booking: {
            field: {
              branch: { id: 1, name: 'Branch 1' },
            },
          },
        },
        {
          amount: new Decimal(200000),
          booking: {
            field: {
              branch: { id: 2, name: 'Branch 2' },
            },
          },
        },
      ]);

      // Act
      const result = await StatsService.getBookingStats();

      // Assert
      expect(result).toHaveProperty('totalBookings', 100);
      expect(result).toHaveProperty('bookingsByStatus');
      expect(result.bookingsByStatus.length).toBe(2);
      expect(result).toHaveProperty('bookingsByDate');
      expect(result.bookingsByDate.length).toBe(2);
      expect(result).toHaveProperty('revenueByBranch');
      expect(result.revenueByBranch.length).toBe(2);
      expect(result.revenueByBranch[0]).toHaveProperty('name', 'Branch 1');
      expect(result.revenueByBranch[0]).toHaveProperty('total', 250000);
      expect(result.revenueByBranch[1]).toHaveProperty('name', 'Branch 2');
      expect(result.revenueByBranch[1]).toHaveProperty('total', 200000);
    });
  });
}); 