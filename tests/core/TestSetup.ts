/**
 * Setup Testing Utama
 * File ini berisi konfigurasi dasar untuk pengujian tanpa mock
*/

// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { DeepMockProxy } from 'jest-mock-extended';
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

  // Setup mock untuk konfigurasi aplikasi
  public setupConfigMock(): void {
    jest.mock('../../src/config/app/env', () => {
      return {
        config: {
          isProduction: false,
          urls: {
            api: 'http://localhost:3001',
            frontend: 'http://localhost:3002',
          },
          jwtSecret: 'test_secret',
          cookies: {
            secure: false,
            sameSite: 'lax',
            maxAge: 3600000
          }
        },
      };
    });
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
          CLEANUP: 'cleanup-expired-bookings',
          AVAILABILITY: 'field-availability-updates',
          AUTH: 'auth'
        },
        KEYS: {
          TOKEN_BLACKLIST: 'test:auth:token_blacklist:',
          SOCKET: {
            ROOT: 'test',
            FIELDS: 'test/fields',
            NOTIFICATION: 'test/notification'
          },
          QUEUE: {
            CLEANUP: 'test:cleanup-expired-bookings',
            AVAILABILITY: 'test:field-availability-updates'
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

  // Setup mock untuk Queue
  public setupQueueMock(): void {
    jest.mock('../../src/config/services/queue', () => {
      return {
        bookingCleanupQueue: {
          add: jest.fn().mockImplementation((data: any) => Promise.resolve({ id: 'mock-job-id', ...data })),
          process: jest.fn(),
        },
        fieldAvailabilityQueue: {
          add: jest.fn().mockImplementation((data: any) => Promise.resolve({ id: 'mock-job-id', ...data })),
          process: jest.fn(),
        }
      };
    });
  }

  // Setup mock untuk JWT
  public setupJwtMock(): void {
    jest.mock('jsonwebtoken', () => ({
      verify: jest.fn().mockImplementation((token, _secret, _options) => {
        // Verifikasi token untuk testing
        if (token === 'invalid_token') {
          throw new Error('Invalid token');
        }
        
        return {
          userId: 1,
          role: 'super_admin',
          branch: { id: 1, name: 'Test Branch' },
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        };
      }),
      sign: jest.fn().mockImplementation((_payload, _secret, _options) => {
        return 'test_token_string';
      })
    }));

    jest.mock('../../src/utils/jwt.utils', () => {
      return {
        verifyToken: jest.fn().mockImplementation((token: string) => {
          // Untuk token mock, ekstrak payload tanpa verifikasi
          if (token && token.includes('mockSignature')) {
            const parts = token.split('.');
            if (parts.length === 3) {
              try {
                // Decode base64
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                return payload;
              } catch (error) {
                console.error('Error parsing test token:', error);
                return null;
              }
            }
          }
          
          // Jika tidak bisa mengenali token, berikan payload default untuk testing
          return {
            id: 2,
            role: 'user',
            permissions: ['read:bookings']
          };
        }),
        generateToken: jest.fn().mockImplementation((payload: any) => {
          return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
            JSON.stringify(payload)
          ).toString('base64')}.mockSignature`;
        }),
      };
    });
  }

  // Setup mock untuk auth.utils
  public setupAuthMock(): void {
    jest.mock('../../src/utils/auth.utils', () => {
      // @ts-ignore - mengabaikan masalah tipe
      const originalModule = jest.requireActual('../../src/utils/auth.utils');
      return {
        ...originalModule,
        getAuthToken: jest.fn().mockImplementation((req: TestRequest) => {
          // Ambil token dari header Authorization jika ada
          const authHeader = req.headers?.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
          }
          // Jika tidak, gunakan cookie (jika ada)
          return req.cookies?.auth_token || req.signedCookies?.auth_token;
        }),
        getCookie: jest.fn().mockImplementation((req: TestRequest, name: string) => {
          // Untuk cookie auth_token, ambil dari header Authorization
          if (name === 'auth_token' && req.headers?.authorization) {
            return req.headers.authorization.replace('Bearer ', '');
          }
          return req.cookies?.[name] || req.signedCookies?.[name];
        }),
        blacklistToken: jest.fn().mockResolvedValue(true),
        setAuthCookie: jest.fn(),
        setRefreshTokenCookie: jest.fn(),
        clearAuthCookie: jest.fn(),
        clearRefreshTokenCookie: jest.fn(),
        isTokenBlacklisted: jest.fn().mockResolvedValue(false),
      };
    });

    // Mock middleware auth untuk bypass pemeriksaan hak akses dalam pengujian
    jest.mock('../../src/middlewares/auth.middleware', () => {
      const originalModule = jest.requireActual('../../src/middlewares/auth.middleware');
      
      // Buat wrapper untuk semua fungsi auth middleware
      const createAuthBypassMiddleware = () => {
        return jest.fn().mockImplementation((_options?: any) => {
          return (req: any, _res: any, next: any) => {
            // Pastikan req.user didefinisikan
            req.user = {
              id: 2,
              role: 'user',
              permissions: ['read:bookings', 'write:bookings']
            };
            
            // Tambahkan userBranch jika diperlukan
            req.userBranch = {
              id: 1001,
              name: 'Test Branch',
              location: 'Test Location',
              ownerId: 3,
              status: 'active',
              createdAt: new Date(),
            };
            next();
          };
        });
      };
      
      return {
        ...originalModule,
        auth: createAuthBypassMiddleware(),
        userAuth: createAuthBypassMiddleware(),
        branchAdminAuth: createAuthBypassMiddleware(),
        ownerAuth: createAuthBypassMiddleware(),
        superAdminAuth: createAuthBypassMiddleware(),
        withBranch: createAuthBypassMiddleware(),
        authMiddleware: createAuthBypassMiddleware(),
        requireRole: jest.fn().mockImplementation((_roles) => {
          return (req: any, res: any, next: any) => {
            next();
          };
        })
      };
    });
  }

  // Setup mock untuk password utils
  public setupPasswordUtilsMock(): void {
    jest.mock('../../src/utils/password.utils', () => {
      return {
        hashPassword: jest.fn().mockImplementation((password: string) => Promise.resolve(`hashed_${password}`)),
        verifyPassword: jest.fn().mockImplementation((password: string, _hashedPassword: string) => {
          return Promise.resolve(password === 'password123');
        }),
      };
    });
  }

  // Setup mock untuk timezone utils
  public setupTimezoneUtilsMock(): void {
    jest.mock('../../src/utils/variables/timezone.utils', () => ({
      TIMEZONE: 'Asia/Jakarta',
      formatDateToWIB: jest.fn().mockImplementation((date: any) => {
        return new Date(date).toISOString();
      }),
      formatDateToUTC: jest.fn().mockImplementation((date: any) => {
        return new Date(date).toISOString();
      }),
      combineDateWithTimeWIB: jest.fn().mockImplementation((date: any, timeString: any) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        const newDate = new Date(date);
        newDate.setHours(hours, minutes, 0, 0);
        return newDate;
      }),
      formatToWIB: jest.fn().mockImplementation((date: any) => {
        return new Date(date).toISOString();
      }),
    }));
  }

  // Setup mock untuk cache utils
  public setupCacheUtilsMock(): void {
    jest.mock('../../src/utils/cache.utils', () => ({
      cacheWithTTL: jest.fn().mockImplementation((_key: any, _ttl: any, fetchFn: any) => {
        return fetchFn();
      }),
      getCachedData: jest.fn().mockImplementation((_key) => {
        return Promise.resolve(null);
      }),
      setCachedData: jest.fn().mockImplementation((_key, _data, _ttl) => {
        return Promise.resolve('OK');
      }),
      deleteCachedData: jest.fn().mockImplementation((_key) => {
        return Promise.resolve(1);
      }),
      clearAllCache: jest.fn().mockImplementation(() => {
        return Promise.resolve('OK');
      }),
      deleteCachedDataByPattern: jest.fn().mockImplementation((_pattern) => {
        return Promise.resolve(1);
      }),
      cacheMiddleware: jest.fn().mockImplementation((_key, _ttl) => {
        return (req: any, res: any, next: any) => {
          next();
        };
      })
    }));
  }

  // Setup mock untuk Cloudinary utils
  public setupCloudinaryUtilsMock(): void {
    jest.mock('../../src/utils/cloudinary.utils', () => ({
      uploadToCloudinary: jest.fn().mockImplementation((_filePath, _folder) => {
        return Promise.resolve({
          public_id: 'test_public_id',
          secure_url: 'https://test-cloudinary-url.com/image.jpg'
        });
      }),
      cleanupUploadedFile: jest.fn().mockImplementation((_filePath) => {
        return Promise.resolve();
      }),
      deleteFromCloudinary: jest.fn().mockImplementation((_publicId) => {
        return Promise.resolve({ result: 'ok' });
      }),
    }));
  }

  // Setup semua mock sekaligus
  public setupAllMocks(): void {
    this.setupConfigMock();
    this.setupRedisMock();
    this.setupQueueMock();
    this.setupJwtMock();
    this.setupAuthMock();
    this.setupPasswordUtilsMock();
    this.setupTimezoneUtilsMock();
    this.setupCacheUtilsMock();
    this.setupCloudinaryUtilsMock();
    this.setupConsoleMock();
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
    // @ts-ignore
    return request[method.toLowerCase()](url)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', [`auth_token=${token}`])
      .send(body);
  }

  // Fungsi untuk membersihkan database
  public async cleanupDatabase(): Promise<void> {
    // Hanya mengembalikan Promise yang resolve tanpa melakukan operasi database
    return Promise.resolve();
  }
} 