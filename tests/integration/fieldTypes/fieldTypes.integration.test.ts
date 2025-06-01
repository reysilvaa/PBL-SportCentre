// @ts-nocheck
import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import express, { Application } from 'express';
import request from 'supertest';
import fieldTypesRoutes from '../../../src/routes/route-lists/fieldTypes.routes';
import errorMiddleware from '../../../src/middlewares/error.middleware';
import prisma from '../../../src/config/services/database';

// Mock dependencies untuk isolasi test integrasi
jest.mock('../../../src/config/services/database', () => {
  const mockFieldTypes = [
    {
      id: 1,
      name: 'Futsal',
      description: null,
      createdAt: new Date(),
      Fields: []
    },
    {
      id: 2,
      name: 'Basket',
      description: null,
      createdAt: new Date(),
      Fields: []
    }
  ];

  return {
    fieldType: {
      findMany: jest.fn().mockResolvedValue(mockFieldTypes),
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (args.where.id === 999) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: args.where.id,
          name: args.where.id === 1 ? 'Futsal' : 'Basket',
          description: null,
          createdAt: new Date()
        });
      }),
      create: jest.fn().mockResolvedValue({
        id: 3,
        name: 'Tenis',
        description: null,
        createdAt: new Date()
      }),
      update: jest.fn().mockImplementation((args: any) => {
        return Promise.resolve({
          id: args.where.id,
          name: args.data.name,
          description: null,
          createdAt: new Date()
        });
      }),
      delete: jest.fn().mockImplementation((args: any) => {
        if (args.where.id === 999) {
          throw new Error('Field type not found');
        }
        return Promise.resolve({
          id: args.where.id,
          name: args.where.id === 1 ? 'Futsal' : 'Basket',
          description: null,
          createdAt: new Date()
        });
      })
    },
    field: {
      findFirst: jest.fn().mockImplementation((args: any) => {
        if (args.where.typeId === 1) {
          return Promise.resolve({
            id: 1,
            name: 'Lapangan Futsal A',
            typeId: 1
          });
        }
        return Promise.resolve(null);
      })
    }
  };
});

// Mock auth middleware
jest.mock('../../../src/middlewares/auth.middleware', () => ({
  auth: jest.fn().mockImplementation(() => (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: 'super_admin' };
    next();
  }),
  superAdminAuth: jest.fn().mockImplementation(() => (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: 'super_admin' };
    next();
  })
}));

let app: Application;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/field-types', fieldTypesRoutes);
  app.use(errorMiddleware as express.ErrorRequestHandler);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Field Types API Integration', () => {
  describe('GET /api/field-types', () => {
    it('should return all field types', async () => {
      const response = await request(app).get('/api/field-types');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(prisma.fieldType.findMany).toHaveBeenCalled();
    });
  });
  
  describe('POST /api/field-types', () => {
    it('should create a new field type', async () => {
      // Pastikan mock create mengembalikan respons yang benar
      (prisma.fieldType.create as jest.Mock).mockResolvedValueOnce({
        id: 3,
        name: 'Tenis',
        description: null,
        createdAt: new Date()
      });
      
      const response = await request(app)
        .post('/api/field-types')
        .send({
          name: 'Tenis'
        });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Berhasil membuat tipe lapangan baru');
      expect(prisma.fieldType.create).toHaveBeenCalled();
    });
    
    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/field-types')
        .send({
          description: 'Lapangan tanpa nama'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Validasi gagal');
    });
  });
  
  describe('PUT /api/field-types/:id', () => {
    it('should update a field type', async () => {
      // Pastikan mock update mengembalikan respons yang benar
      (prisma.fieldType.update as jest.Mock).mockResolvedValueOnce({
        id: 1,
        name: 'Futsal Update',
        description: null,
        createdAt: new Date()
      });
      
      const response = await request(app)
        .put('/api/field-types/1')
        .send({
          name: 'Futsal Update'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Berhasil memperbarui tipe lapangan');
      expect(prisma.fieldType.update).toHaveBeenCalled();
    });
    
    it('should return 404 if field type not found', async () => {
      // Mock untuk kasus tidak ditemukan
      (prisma.fieldType.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const response = await request(app)
        .put('/api/field-types/999')
        .send({
          name: 'Update Tidak Ada'
        });
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Tipe lapangan tidak ditemukan');
    });
  });
  
  describe('DELETE /api/field-types/:id', () => {
    it('should delete a field type', async () => {
      // Mock untuk penghapusan berhasil
      (prisma.fieldType.delete as jest.Mock).mockResolvedValueOnce({
        id: 2,
        name: 'Basket',
        description: null,
        createdAt: new Date()
      });
      
      const response = await request(app).delete('/api/field-types/2');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', true);
      expect(response.body).toHaveProperty('message', 'Berhasil menghapus tipe lapangan');
      expect(prisma.fieldType.delete).toHaveBeenCalled();
    });
    
    it('should return 404 if field type not found', async () => {
      // Mock untuk tipe yang tidak ditemukan
      (prisma.fieldType.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const response = await request(app).delete('/api/field-types/999');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Tipe lapangan tidak ditemukan');
    });
    
    it('should return 400 if field type is in use', async () => {
      // Mock findUnique terlebih dahulu
      (prisma.fieldType.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 1,
        name: 'Futsal',
        description: null,
        createdAt: new Date()
      });
      
      // Mock field.findFirst untuk skenario ini
      (prisma.field.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 1,
        name: 'Lapangan Futsal A',
        typeId: 1
      });
      
      const response = await request(app).delete('/api/field-types/1');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('status', false);
      expect(response.body).toHaveProperty('message', 'Tidak dapat menghapus tipe lapangan yang sedang digunakan');
    });
  });
}); 