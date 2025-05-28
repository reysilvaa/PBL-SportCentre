import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { jest } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';
import dotenv from 'dotenv';

// Tipe untuk request express dengan headers dan cookie
export interface TestRequest {
  headers?: {
    authorization?: string;
    [key: string]: any;
  };
  cookies?: {
    [key: string]: string;
  };
  signedCookies?: {
    [key: string]: string;
  };
}

// Kelas dasar untuk setup pengujian
export class TestSetup {
  protected static instance: TestSetup;
  protected prismaMock: DeepMockProxy<PrismaClient> | null = null;

  constructor() {
    // Meningkatkan batas waktu pengujian menjadi 30 detik
    jest.setTimeout(30000);
    
    // Menggunakan file .env.test jika ada, atau .env
    dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });
  }

  // Implementasi singleton pattern
  public static getInstance(): TestSetup {
    if (!TestSetup.instance) {
      TestSetup.instance = new TestSetup();
    }
    return TestSetup.instance;
  }

  // Setup mock untuk console (menghilangkan output konsol selama pengujian)
  public setupConsoleMock(): void {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  }

  // Setup mock untuk database Prisma
  public setupPrismaMock(): DeepMockProxy<PrismaClient> {
    if (!this.prismaMock) {
      this.prismaMock = mockDeep<PrismaClient>();
      
      jest.mock('../config/services/database', () => ({
        __esModule: true,
        default: this.prismaMock,
      }));
    }
    
    return this.prismaMock;
  }

  // Setup mock untuk Redis
  public setupRedisMock(): void {
    jest.mock('../../src/config/services/redis', () => {
      return {
        redisClient: {
          get: jest.fn().mockResolvedValue(null),
          set: jest.fn().mockResolvedValue('OK'),
          del: jest.fn().mockResolvedValue(1),
          exists: jest.fn().mockResolvedValue(0),
          flushall: jest.fn().mockResolvedValue('OK'),
          keys: jest.fn().mockResolvedValue([]),
        },
        NAMESPACE: {
          PREFIX: 'test',
          BOOKING: 'booking',
          NOTIFICATION: 'notification',
          AUTH: 'auth'
        },
        KEYS: {
          TOKEN_BLACKLIST: 'test:auth:token_blacklist:',
          SOCKET: {
            ROOT: 'test',
            FIELDS: 'test/fields',
            NOTIFICATION: 'test/notification'
          },
          CACHE: {
            FIELD: 'test:fields:',
            BRANCH: 'test:branches:',
            USER: 'test:users:',
            BOOKING: 'test:bookings:',
            PAYMENT: 'test:payments:'
          }
        },
        ensureConnection: {
          exists: jest.fn().mockResolvedValue(0),
          setEx: jest.fn().mockResolvedValue('OK'),
          del: jest.fn().mockResolvedValue(1),
          get: jest.fn().mockResolvedValue(null),
          set: jest.fn().mockResolvedValue('OK'),
          keys: jest.fn().mockResolvedValue([]),
        }
      };
    });
  }

  // Setup mock untuk JWT
  public setupJwtMock(): void {
    jest.mock('../../src/utils/jwt.utils', () => {
      return {
        generateToken: jest.fn().mockReturnValue('valid_test_token'),
        verifyToken: jest.fn().mockImplementation((token) => {
          if (token === 'valid_test_token' || token === 'valid_user_token') {
            return { userId: 1, role: 'user' };
          } else if (token === 'valid_admin_token') {
            return { userId: 2, role: 'admin' };
          } else {
            throw new Error('Invalid token');
          }
        }),
      };
    });
  }

  // Setup mock untuk Socket.IO
  public setupSocketMock(): void {
    jest.mock('socket.io', () => {
      const mockSocket = {
        on: jest.fn(),
        emit: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        to: jest.fn().mockReturnThis(),
        disconnect: jest.fn(),
        data: {},
      };
      
      const mockIO = {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'connection') {
            callback(mockSocket);
          }
          return mockIO;
        }),
        emit: jest.fn(),
        of: jest.fn().mockReturnThis(),
        to: jest.fn().mockReturnThis(),
        use: jest.fn().mockImplementation((middleware) => {
          middleware(mockSocket, jest.fn());
          return mockIO;
        }),
      };
      
      return { Server: jest.fn(() => mockIO) };
    });
  }

  // Fungsi untuk menyiapkan aplikasi express dengan middleware yang diperlukan
  public setupExpressApp(router: any) {
    const app = express();
    app.use(express.json());
    app.use(cookieParser('test_secret'));
    app.use('/api', router);
    return app;
  }

  // Fungsi untuk membuat header otentikasi untuk test
  public createAuthHeaders() {
    return {
      Authorization: `Bearer valid_user_token`,
      Cookie: [`auth_token=valid_user_token`]
    };
  }

  // Fungsi untuk request dengan token autentikasi
  public requestWithAuth(app: any, method: string, url: string, token: string = 'valid_user_token', body: any = {}) {
    const request = supertest(app);
    return request[method.toLowerCase()](url)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', [`auth_token=${token}`])
      .send(body);
  }
} 