import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { integrationTestSetup } from '../core';

// Setup untuk pengujian integrasi
const { request, requestWithAuth, prismaMock, mockUsers, mockTokens } = integrationTestSetup.setupIntegrationTest();

describe('Auth API Integration Tests', () => {
  beforeAll(async () => {
    // Konfigurasi spesifik untuk pengujian auth
  });
  
  afterAll(async () => {
    // Bersihkan pengujian auth
  });

  describe('POST /api/auth/register', () => {
    it('seharusnya mendaftarkan pengguna baru dengan sukses', async () => {
      // Setup
      const newUser = {
        email: 'newuser@test.com',
        password: 'password123',
        name: 'New Test User',
        phone: '081234567899',
        role: 'user',
      };
      
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValueOnce({
        id: 5,
        ...newUser,
        password: 'hashed_password',
        createdAt: new Date()
      } as any);
      
      // Execute
      const response = await request.post('/api/auth/register').send(newUser);
      
      // Verify
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', newUser.email);
      expect(response.body.user).toHaveProperty('name', newUser.name);
      expect(response.body.user).not.toHaveProperty('password');

    });
    
    it('seharusnya menolak pendaftaran dengan email yang sudah ada', async () => {
      // Setup - gunakan email yang sudah terdaftar
      const existingUser = {
        email: 'user@test.com', // Email yang sudah ada
        password: 'password123',
        name: 'Duplicate User',
        phone: '081234567891',
        role: 'user',
      };
      
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUsers[1] as any);
      
      // Execute
      const response = await request.post('/api/auth/register').send(existingUser);
      
      // Verify
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'Email sudah terdaftar');
    });
    
    it('seharusnya menolak pendaftaran dengan data tidak valid', async () => {
      // Setup - data tidak lengkap
      const invalidUser = {
        email: 'invalid@test', // Email tidak valid
        password: '123', // Password terlalu pendek
        // Nama kosong
        phone: '123', // Nomor telepon tidak valid
        role: 'user',
      };
      
      // Execute
      const response = await request.post('/api/auth/register').send(invalidUser);
      
      // Verify
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /api/auth/login', () => {
    it('seharusnya berhasil login dengan kredensial yang benar', async () => {
      // Setup
      const loginData = {
        email: 'user@test.com',
        password: 'password123'
      };
      
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUsers[1] as any);
      
      // Execute
      const response = await request.post('/api/auth/login').send(loginData);
      
      // Verify
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', loginData.email);
    });
    
    it('seharusnya menolak login dengan email tidak terdaftar', async () => {
      // Setup
      const loginData = {
        email: 'notfound@test.com',
        password: 'password123'
      };
      
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      
      // Execute
      const response = await request.post('/api/auth/login').send(loginData);
      
      // Verify
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Kredensial tidak valid');
    });
    
    it('seharusnya menolak login dengan password salah', async () => {
      // Setup
      const loginData = {
        email: 'user@test.com',
        password: 'wrong_password'
      };
      
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUsers[1] as any);
      
      // Execute
      const response = await request.post('/api/auth/login').send(loginData);
      
      // Verify
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Kredensial tidak valid');
    });
  });
  
  describe('GET /api/auth/status', () => {
    it('seharusnya mengembalikan informasi pengguna dengan token', async () => {
      // Execute
      const response = await requestWithAuth('get', '/api/auth/status', mockTokens.validUserToken);
      
      // Verify
      expect(response.status).toBe(200);
      // Saat ini backend mengembalikan data user dan token, bukan status loggedIn
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
    });
    
    it('seharusnya mengembalikan unauthorized tanpa token', async () => {
      // Execute
      const response = await request.get('/api/auth/status');
      
      // Verify
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Tidak terautentikasi');
    });
  });
  
  describe('POST /api/auth/logout', () => {
    it('seharusnya berhasil logout dengan token', async () => {
      // Execute
      const response = await requestWithAuth('post', '/api/auth/logout', mockTokens.validUserToken);
      
      // Verify
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logout berhasil');
    });
  });
}); 