import { jest } from '@jest/globals';
import supertest from 'supertest';

// Menggunakan tipe cast untuk mengatasi masalah tipe dengan supertest
export const createSuperTest = (app: any): any => {
  return supertest(app);
};

// Mock untuk tipe Request dan Response Express
export type MockRequest = {
  user?: {
    id: number;
    role: string;
    [key: string]: any;
  };
  headers?: {
    authorization?: string;
    [key: string]: any;
  };
  cookies?: {
    [key: string]: string;
  };
  body?: any;
  params?: any;
  query?: any;
  [key: string]: any;
};

export type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  setHeader: jest.Mock;
  [key: string]: any;
};

// Fungsi untuk membuat mock response Express
export const createMockResponse = (): MockResponse => {
  const res: Partial<MockResponse> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res as MockResponse;
};

// Fungsi untuk membuat mock request Express
export const createMockRequest = (overrides?: Partial<MockRequest>): MockRequest => {
  const req: MockRequest = {
    user: { id: 1, role: 'user' },
    headers: { authorization: 'Bearer valid_user_token' },
    cookies: {},
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
  return req;
};

// Mock untuk middleware Express
export const createMockNext = () => jest.fn(); 