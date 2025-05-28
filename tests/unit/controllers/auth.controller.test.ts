import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { unitTestSetup } from '../../core';

// Setup unit test untuk controller
const { prismaMock } = unitTestSetup.setupControllerTest();

// Import controller setelah mengatur mock
import { login, register, logout } from '../../../src/controllers/auth.controller';

describe('Auth Controller', () => {
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
      signedCookies: {},
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

  describe('register', () => {
    it('seharusnya mendaftarkan pengguna baru dengan sukses', async () => {
      // Setup
      mockRequest.body = {
        email: 'newuser@test.com',
        password: 'password123',
        name: 'New User',
        phone: '085678901234',
        role: 'user',
      };

      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValueOnce({
        id: 4,
        email: 'newuser@test.com',
        password: 'hashed_password',
        name: 'New User',
        phone: '085678901234',
        role: 'user',
        createdAt: new Date(),
      } as any);

      // Execute
      await register(mockRequest as Request, mockResponse as Response);

      // Verify
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newuser@test.com' },
      });
      expect(prismaMock.user.create).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'newuser@test.com',
            name: 'New User',
          }),
        })
      );
    });

    it('seharusnya mengembalikan kesalahan jika email sudah terdaftar', async () => {
      // Setup
      mockRequest.body = {
        email: 'admin@test.com', // Email yang sudah ada di mockUsers
        password: 'password123',
        name: 'Duplicate User',
        phone: '085678901234',
        role: 'user',
      };

      // @ts-ignore - mengabaikan masalah tipe pada mockResolvedValueOnce dengan Partial
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 1,
        email: 'admin@test.com',
        password: 'hashed_password123',
        name: 'Admin User',
        role: 'super_admin',
        phone: '081234567890',
        createdAt: new Date(),
      });

      // Execute
      await register(mockRequest as Request, mockResponse as Response);

      // Verify
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@test.com' },
      });
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Email sudah terdaftar' });
    });
  });

  describe('login', () => {
    it('seharusnya berhasil login dengan email dan password yang benar', async () => {
      // Setup
      mockRequest.body = {
        email: 'user@test.com',
        password: 'password123',
      };

      // @ts-ignore - mengabaikan masalah tipe pada mockResolvedValueOnce dengan Partial
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 2,
        email: 'user@test.com',
        password: 'hashed_password123',
        name: 'Test User',
        role: 'user',
        phone: '081234567891',
        createdAt: new Date(),
      });

      // Execute
      await login(mockRequest as Request, mockResponse as Response);

      // Verify
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@test.com' },
      });
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            email: 'user@test.com',
            name: 'Test User',
          }),
        })
      );
    });

    it('seharusnya mengembalikan kesalahan jika kredensial tidak valid', async () => {
      // Setup
      mockRequest.body = {
        email: 'user@test.com',
        password: 'wrong_password', // Password salah
      };

      // @ts-ignore - mengabaikan masalah tipe pada mockResolvedValueOnce dengan Partial
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 2,
        email: 'user@test.com',
        password: 'hashed_password123',
        name: 'Test User',
        role: 'user',
        phone: '081234567891',
        createdAt: new Date(),
      });

      // Execute
      await login(mockRequest as Request, mockResponse as Response);

      // Verify
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Kredensial tidak valid' });
    });
  });

  describe('logout', () => {
    it('seharusnya berhasil logout dan menghapus token dari cookie', async () => {
      // Setup
      // @ts-ignore - mengabaikan masalah tipe pada mockReturnValue
      mockRequest.header = jest.fn().mockReturnValue('Bearer valid_token');
      mockRequest.signedCookies = {
        auth_token: 'valid_cookie_token',
        refresh_token: 'valid_refresh_token',
      };

      // Execute
      await logout(mockRequest as Request, mockResponse as Response);

      // Verify
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Logout berhasil' });
    });
  });
});
