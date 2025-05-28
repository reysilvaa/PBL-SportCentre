import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { unitTestSetup } from '../../core';
import * as activityLogController from '../../../src/controllers/activityLog.controller';
import { Role } from '../../../src/types';

// Mock ActivityLogService
jest.mock('../../../src/utils/activityLog/activityLog.utils', () => ({
  ActivityLogService: {
    getLogs: jest.fn(),
    createLog: jest.fn(),
    broadcastActivityLogUpdates: jest.fn()
  }
}));

// Import setelah mock
import { ActivityLogService } from '../../../src/utils/activityLog/activityLog.utils';

// Mock cache invalidation
jest.mock('../../../src/utils/cache/cacheInvalidation.utils', () => ({
  invalidateActivityLogCache: jest.fn()
}));

// Setup untuk pengujian unit
const { prismaMock } = unitTestSetup.setupControllerTest();

describe('Activity Log Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      body: {},
      // @ts-ignore - mengabaikan masalah tipe pada header
      header: jest.fn(),
      ip: '127.0.0.1',
      query: {},
      user: {},
    };

    mockResponse = {
      // @ts-ignore - mengabaikan masalah tipe pada json dan status
      json: jsonMock,
      // @ts-ignore - mengabaikan masalah tipe pada json dan status
      status: statusMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getActivityLogs', () => {
    it('seharusnya mengembalikan semua log untuk super admin', async () => {
      // Setup
      mockRequest.user = { id: 1, role: Role.SUPER_ADMIN };
      
      const mockLogs = [
        {
          id: 1,
          userId: 2,
          action: 'LOGIN',
          details: 'User login',
          createdAt: new Date(),
          user: { id: 2, name: 'Pengguna', email: 'user@example.com' }
        },
        {
          id: 2,
          userId: 3,
          action: 'CREATE_BOOKING',
          details: 'Created new booking',
          createdAt: new Date(),
          user: { id: 3, name: 'Pelanggan', email: 'customer@example.com' }
        }
      ];
      
      (ActivityLogService.getLogs as jest.Mock).mockResolvedValue(mockLogs);

      // Execute
      await activityLogController.getActivityLogs(mockRequest as any, mockResponse as Response);

      // Verify
      expect(ActivityLogService.getLogs).toHaveBeenCalledWith(undefined); // tidak ada filter userId
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil mendapatkan log aktivitas',
        data: mockLogs
      });
    });

    it('seharusnya memfilter log berdasarkan userId untuk super admin', async () => {
      // Setup
      mockRequest.user = { id: 1, role: Role.SUPER_ADMIN };
      mockRequest.query = { userId: '2' };
      
      const filteredLogs = [
        {
          id: 1,
          userId: 2,
          action: 'LOGIN',
          details: 'User login',
          createdAt: new Date(),
          user: { id: 2, name: 'Pengguna', email: 'user@example.com' }
        }
      ];
      
      (ActivityLogService.getLogs as jest.Mock).mockResolvedValue(filteredLogs);

      // Execute
      await activityLogController.getActivityLogs(mockRequest as any, mockResponse as Response);

      // Verify
      expect(ActivityLogService.getLogs).toHaveBeenCalledWith(2);
      expect(statusMock).toHaveBeenCalledWith(200);
    });
    
    it('seharusnya membatasi log pengguna biasa hanya untuk log sendiri', async () => {
      // Setup
      mockRequest.user = { id: 2, role: Role.USER };
      
      const userLogs = [
        {
          id: 1,
          userId: 2,
          action: 'LOGIN',
          details: 'User login',
          createdAt: new Date()
        }
      ];
      
      (ActivityLogService.getLogs as jest.Mock).mockResolvedValue(userLogs);

      // Execute
      await activityLogController.getActivityLogs(mockRequest as any, mockResponse as Response);

      // Verify
      expect(ActivityLogService.getLogs).toHaveBeenCalledWith(2); // filter untuk user sendiri
      expect(statusMock).toHaveBeenCalledWith(200);
    });
    
    it('seharusnya melakukan broadcast update jika parameter realtime=true', async () => {
      // Setup
      mockRequest.user = { id: 1, role: Role.SUPER_ADMIN };
      mockRequest.query = { realtime: 'true' };
      
      (ActivityLogService.getLogs as jest.Mock).mockResolvedValue([]);

      // Execute
      await activityLogController.getActivityLogs(mockRequest as any, mockResponse as Response);

      // Verify
      expect(ActivityLogService.broadcastActivityLogUpdates).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });
    
    it('seharusnya menangani error saat mengambil log', async () => {
      // Setup
      mockRequest.user = { id: 1, role: Role.SUPER_ADMIN };
      
      (ActivityLogService.getLogs as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Execute
      await activityLogController.getActivityLogs(mockRequest as any, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Gagal mengambil log aktivitas'
      });
    });
  });

  describe('createActivityLog', () => {
    it('seharusnya membuat log aktivitas baru', async () => {
      // Setup
      const logData = {
        userId: 2,
        action: 'CUSTOM_ACTION',
        details: 'Detail aktivitas',
        relatedId: 123
      };
      
      mockRequest.body = logData;
      mockRequest.user = { id: 2, role: Role.USER };
      mockRequest.ip = '192.168.1.1';
      
      const mockCreatedLog = {
        id: 10,
        ...logData,
        createdAt: new Date()
      };
      
      (ActivityLogService.createLog as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Execute
      await activityLogController.createActivityLog(mockRequest as any, mockResponse as Response);

      // Verify
      expect(ActivityLogService.createLog).toHaveBeenCalledWith(
        logData.userId,
        logData.action,
        logData.details,
        logData.relatedId,
        mockRequest.ip
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: 'Berhasil membuat log aktivitas',
        data: mockCreatedLog
      });
    });
    
    it('seharusnya menolak jika data tidak valid', async () => {
      // Setup
      const invalidData = {
        // userId hilang
        action: 'INVALID_ACTION'
        // details hilang
      };
      
      mockRequest.body = invalidData;
      mockRequest.user = { id: 2, role: Role.USER };

      // Execute
      await activityLogController.createActivityLog(mockRequest as any, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: false,
          message: 'Validasi gagal'
        })
      );
    });
    
    it('seharusnya menolak jika user mencoba membuat log untuk user lain', async () => {
      // Setup
      const logData = {
        userId: 3, // user ID berbeda dari req.user.id
        action: 'UNAUTHORIZED_ACTION',
        details: 'Detail aktivitas'
      };
      
      mockRequest.body = logData;
      mockRequest.user = { id: 2, role: Role.USER };

      // Execute
      await activityLogController.createActivityLog(mockRequest as any, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Anda hanya dapat membuat log untuk diri sendiri'
      });
    });
    
    it('seharusnya mengizinkan super admin membuat log untuk user lain', async () => {
      // Setup
      const logData = {
        userId: 3, // ID pengguna lain
        action: 'ADMIN_ACTION',
        details: 'Admin activity'
      };
      
      mockRequest.body = logData;
      mockRequest.user = { id: 1, role: Role.SUPER_ADMIN };
      
      const mockCreatedLog = {
        id: 11,
        ...logData,
        createdAt: new Date()
      };
      
      (ActivityLogService.createLog as jest.Mock).mockResolvedValue(mockCreatedLog);

      // Execute
      await activityLogController.createActivityLog(mockRequest as any, mockResponse as Response);

      // Verify
      expect(ActivityLogService.createLog).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
    });
    
    it('seharusnya menangani error saat membuat log', async () => {
      // Setup
      const logData = {
        userId: 2,
        action: 'ERROR_ACTION',
        details: 'Detail aktivitas'
      };
      
      mockRequest.body = logData;
      mockRequest.user = { id: 2, role: Role.USER };
      
      (ActivityLogService.createLog as jest.Mock).mockRejectedValue(new Error('Service error'));

      // Execute
      await activityLogController.createActivityLog(mockRequest as any, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: 'Gagal membuat log aktivitas'
      });
    });
  });
}); 