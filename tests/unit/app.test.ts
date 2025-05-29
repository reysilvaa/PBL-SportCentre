// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import { config, initializeApplication, startServer } from '../../src/config';
import router from '../../src/routes/index.routes';
import errorMiddleware from '../../src/middlewares/error.middleware';
import { setupSwagger } from '../../src/config/swagger/swagger.config';
import { setupGracefulShutdown } from '../../src/utils/gracefulShutdown.utils';

// Mock dependencies
jest.mock('../../src/config', () => ({
  config: {
    isProduction: false,
    urls: { api: 'http://localhost:3000/api' },
  },
  initializeApplication: jest.fn().mockReturnValue({
    listen: jest.fn(),
    close: jest.fn(),
  }),
  startServer: jest.fn(),
  setupCacheControl: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../src/routes/index.routes', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../src/middlewares/error.middleware', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../src/config/swagger/swagger.config', () => ({
  setupSwagger: jest.fn(),
}));

jest.mock('../../src/utils/gracefulShutdown.utils', () => ({
  setupGracefulShutdown: jest.fn(),
}));

// Mock express
jest.mock('express', () => {
  const mockApp = {
    set: jest.fn(),
    locals: {},
    use: jest.fn(),
  };
  return jest.fn().mockReturnValue(mockApp);
});

describe('App Configuration', () => {
  let app: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Memastikan express() dipanggil untuk membuat app baru
    app = express();
  });

  it('seharusnya mengonfigurasi express app dengan benar', () => {
    // Impor ulang untuk memicu kode inisialisasi
    jest.isolateModules(() => {
      require('../../src/app');
    });
    
    // Verifikasi trust proxy dikonfigurasi berdasarkan environment
    expect(app.set).toHaveBeenCalledWith('trust proxy', false);
    
    // Verifikasi baseUrl dikonfigurasi
    expect(app.locals.baseUrl).toBe('http://localhost:3000/api');
    
    // Verifikasi bahwa initializeApplication dipanggil dengan app
    expect(initializeApplication).toHaveBeenCalledWith(app);
    
    // Verifikasi setup Swagger
    expect(setupSwagger).toHaveBeenCalledWith(app);
    
    // Verifikasi router digunakan
    expect(app.use).toHaveBeenCalledWith('/api', expect.any(Function), router);
    
    // Verifikasi error middleware digunakan
    expect(app.use).toHaveBeenCalledWith(errorMiddleware);
    
    // Verifikasi graceful shutdown
    expect(setupGracefulShutdown).toHaveBeenCalled();
    
    // Verifikasi server dimulai
    expect(startServer).toHaveBeenCalled();
  });
  
  it('seharusnya mengatur trust proxy berbeda di production', () => {
    // Ubah environment ke production
    config.isProduction = true;
    
    // Impor ulang untuk memicu kode inisialisasi
    jest.isolateModules(() => {
      require('../../src/app');
    });
    
    // Verifikasi trust proxy dikonfigurasi untuk production
    expect(app.set).toHaveBeenCalledWith('trust proxy', '1');
    
    // Reset environment
    config.isProduction = false;
  });
}); 