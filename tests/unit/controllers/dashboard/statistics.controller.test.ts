import { Request, Response } from 'express';
import { jest } from '@jest/globals';
import * as StatisticsController from '../../../../src/controllers/dashboard/statistics.controller';
import * as UnifiedStatsService from '../../../../src/repositories/statistics/unifiedStats.service';
import { Role } from '../../../../src/types/enums';

// Mock dependencies
jest.mock('../../../../src/repositories/statistics/unifiedStats.service', () => ({
  getTimeRange: jest.fn(),
  getSuperAdminStatsWithCharts: jest.fn(),
  getOwnerCabangStats: jest.fn(),
  getAdminCabangStats: jest.fn(),
  getUserStats: jest.fn(),
}));

describe('Statistics Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockTimeRange: any;
  
  beforeEach(() => {
    mockTimeRange = {
      start: new Date('2025-01-01'),
      end: new Date('2025-01-31'),
    };
    
    mockReq = {
      query: { period: 'monthly' },
      user: {
        id: 1,
        role: Role.SUPER_ADMIN,
      },
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Reset semua mock
    (UnifiedStatsService.getTimeRange as jest.Mock).mockReturnValue(mockTimeRange);
    jest.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    // Arrange
    mockReq.user = undefined;

    // Act
    await StatisticsController.getDashboardStats(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
  });

  it('should return super admin stats when role is SUPER_ADMIN', async () => {
    // Arrange
    mockReq.user = { id: 1, role: Role.SUPER_ADMIN };
    const mockStats = {
      totalBranches: 10,
      totalUsers: 100,
      totalFields: 25,
      activePromotions: 5,
      regions: [],
      branches: []
    };
    
    (UnifiedStatsService.getSuperAdminStatsWithCharts as jest.Mock).mockResolvedValue(mockStats);
    (UnifiedStatsService.getTimeRange as jest.Mock).mockReturnValue(mockTimeRange);

    // Act
    await StatisticsController.getDashboardStats(mockReq as Request, mockRes as Response);

    // Assert
    expect(UnifiedStatsService.getTimeRange).toHaveBeenCalledWith('monthly');
    expect(UnifiedStatsService.getSuperAdminStatsWithCharts).toHaveBeenCalledWith(mockTimeRange);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(mockStats);
  });

  it('should return owner cabang stats when role is OWNER_CABANG', async () => {
    // Arrange
    mockReq.user = { id: 2, role: Role.OWNER_CABANG };
    const mockStats = {
      totalFields: 8,
      activeFields: 6,
      branchName: 'Cabang Utara',
      bookings: [],
      topBookings: []
    };
    
    (UnifiedStatsService.getOwnerCabangStats as jest.Mock).mockResolvedValue(mockStats);

    // Act
    await StatisticsController.getDashboardStats(mockReq as Request, mockRes as Response);

    // Assert
    expect(UnifiedStatsService.getTimeRange).toHaveBeenCalledWith('monthly');
    expect(UnifiedStatsService.getOwnerCabangStats).toHaveBeenCalledWith(2, mockTimeRange);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(mockStats);
  });

  it('should return admin cabang stats when role is ADMIN_CABANG', async () => {
    // Arrange
    mockReq.user = { id: 3, role: Role.ADMIN_CABANG };
    const mockStats = {
      totalFields: 5,
      todayBookings: 12,
      pendingPayments: 3,
      activeFields: 4,
      bookings: []
    };
    
    (UnifiedStatsService.getAdminCabangStats as jest.Mock).mockResolvedValue(mockStats);

    // Act
    await StatisticsController.getDashboardStats(mockReq as Request, mockRes as Response);

    // Assert
    expect(UnifiedStatsService.getTimeRange).toHaveBeenCalledWith('monthly');
    expect(UnifiedStatsService.getAdminCabangStats).toHaveBeenCalledWith(3, mockTimeRange);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(mockStats);
  });

  it('should return user stats when role is USER', async () => {
    // Arrange
    mockReq.user = { id: 4, role: Role.USER };
    const mockStats = {
      upcomingBookings: 3,
      pastBookings: 8,
      favoriteField: 'Lapangan Futsal Elang',
      totalSpent: 850000
    };
    
    (UnifiedStatsService.getUserStats as jest.Mock).mockResolvedValue(mockStats);

    // Act
    await StatisticsController.getDashboardStats(mockReq as Request, mockRes as Response);

    // Assert
    expect(UnifiedStatsService.getTimeRange).toHaveBeenCalledWith('monthly');
    expect(UnifiedStatsService.getUserStats).toHaveBeenCalledWith(4, mockTimeRange);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(mockStats);
  });

  it('should return 400 if role is invalid', async () => {
    // Arrange
    mockReq.user = { id: 5, role: 'INVALID_ROLE' };

    // Act
    await StatisticsController.getDashboardStats(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Role tidak valid' });
  });

  it('should use daily time range when period is daily', async () => {
    // Arrange
    mockReq.query = { period: 'daily' };
    const dailyTimeRange = {
      start: new Date('2025-06-01T00:00:00'),
      end: new Date('2025-06-01T23:59:59'),
    };
    
    (UnifiedStatsService.getTimeRange as jest.Mock).mockReturnValue(dailyTimeRange);
    
    // Act
    await StatisticsController.getDashboardStats(mockReq as Request, mockRes as Response);

    // Assert
    expect(UnifiedStatsService.getTimeRange).toHaveBeenCalledWith('daily');
    expect(UnifiedStatsService.getSuperAdminStatsWithCharts).toHaveBeenCalledWith(dailyTimeRange);
  });

  it('should use yearly time range when period is yearly', async () => {
    // Arrange
    mockReq.query = { period: 'yearly' };
    const yearlyTimeRange = {
      start: new Date('2025-01-01'),
      end: new Date('2025-12-31'),
    };
    
    (UnifiedStatsService.getTimeRange as jest.Mock).mockReturnValue(yearlyTimeRange);
    
    // Act
    await StatisticsController.getDashboardStats(mockReq as Request, mockRes as Response);

    // Assert
    expect(UnifiedStatsService.getTimeRange).toHaveBeenCalledWith('yearly');
    expect(UnifiedStatsService.getSuperAdminStatsWithCharts).toHaveBeenCalledWith(yearlyTimeRange);
  });

  it('should handle service error properly', async () => {
    // Arrange
    (UnifiedStatsService.getSuperAdminStatsWithCharts as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    // Act
    await StatisticsController.getDashboardStats(mockReq as Request, mockRes as Response);

    // Assert
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Terjadi kesalahan saat mengambil statistik dashboard'
    });
  });
}); 