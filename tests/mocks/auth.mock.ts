import { jest } from '@jest/globals';

// Mock untuk middleware autentikasi
export const mockAuthMiddleware = () => {
  jest.mock('../../src/middlewares/auth.middleware', () => ({
    authMiddleware: jest.fn().mockImplementation((token: any) => {
      if (token === 'valid_user_token') {
        return { userId: 1, role: 'user' };
      } else if (token === 'valid_admin_token') {
        return { userId: 2, role: 'admin' };
      }
      return null;
    }),
    authMiddlewareExpress: jest.fn().mockImplementation((req: any, res: any, next: any) => {
      req.user = { id: 1, role: 'user' };
      next();
    }),
  }));
};

// Mock untuk util autentikasi
export const mockAuthUtils = () => {
  jest.mock('../../src/utils/auth.utils', () => ({
    getAuthToken: jest.fn().mockReturnValue('valid_user_token'),
    setCookieToken: jest.fn(),
    clearCookieToken: jest.fn(),
    generateToken: jest.fn().mockReturnValue('valid_user_token'),
    verifyToken: jest.fn().mockImplementation((token: any) => {
      if (token === 'valid_user_token') {
        return { userId: 1, role: 'user' };
      } else if (token === 'valid_admin_token') {
        return { userId: 2, role: 'admin' };
      }
      return null;
    }),
  }));
};

// Mock untuk cookie-parser
export const mockCookieParser = () => {
  jest.mock('cookie-parser', () => {
    return jest.fn().mockImplementation(() => {
      return (req: any, res: any, next: any) => {
        req.cookies = { auth_token: 'valid_user_token' };
        next();
      };
    });
  });
};

// Mock untuk utilitas password
export const mockPasswordUtils = () => {
  jest.mock('../../src/utils/password.utils', () => ({
    comparePassword: jest.fn().mockResolvedValue(true as any),
    hashPassword: jest.fn().mockResolvedValue('$2b$10$abcdefghijklmnopqrstuvwxyz' as any),
  }));
};

// Setup semua mock autentikasi sekaligus
export const setupAllAuthMocks = () => {
  mockAuthMiddleware();
  mockAuthUtils();
  mockCookieParser();
  mockPasswordUtils();
};

// Export konstanta untuk memudahkan penggunaan
export const AUTH_TOKENS = {
  USER: 'valid_user_token',
  ADMIN: 'valid_admin_token',
  INVALID: 'invalid_token'
};

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin'
};

// Fungsi bantuan untuk test
export const createAuthHeader = (token: string = AUTH_TOKENS.USER) => ({
  Authorization: `Bearer ${token}`
});

export const createMockUser = (id: number = 1, role: string = USER_ROLES.USER) => ({
  id,
  userId: id,
  role,
  name: `Test ${role}`,
  email: `test${id}@example.com`
});

export default setupAllAuthMocks; 