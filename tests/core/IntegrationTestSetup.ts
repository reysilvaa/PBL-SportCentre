import { TestSetup } from './TestSetup';
import { MockDataFactory } from './MockDataFactory';
import { jest } from '@jest/globals';
import supertest from 'supertest';

export class IntegrationTestSetup extends TestSetup {
  protected static instance: IntegrationTestSetup;
  private mockDataFactory: MockDataFactory;

  private constructor() {
    super();
    this.mockDataFactory = MockDataFactory.getInstance();
  }

  public static getInstance(): IntegrationTestSetup {
    if (!IntegrationTestSetup.instance) {
      IntegrationTestSetup.instance = new IntegrationTestSetup();
    }
    return IntegrationTestSetup.instance;
  }

  /**
   * Menyiapkan pengujian integrasi antara layanan
   * @returns Objek dengan mock dan utilitas pengujian
   */
  public setupIntegrationTest() {
    // Setup semua mock dasar
    this.setupAllMocks();
    
    // Mock prisma untuk integration test
    const prismaMock = this.mockDataFactory.setupPrismaMocks();
    
    // Mock database service
    jest.mock('../../src/config/services/database', () => {
      return {
        __esModule: true,
        default: prismaMock,
      };
    });
    
    // Setup aplikasi express dengan router yang dibutuhkan
    const app = this.setupExpressApp(require('../../src/routes/index.routes').default);
    
    return {
      app,
      prismaMock,
      request: supertest(app),
      requestWithAuth: this.requestWithAuth.bind(this, app),
      createAuthHeaders: this.createAuthHeaders.bind(this),
      mockTokens: this.mockDataFactory.getMockTokens(),
      mockUsers: this.mockDataFactory.getMockUsers(),
      mockBranches: this.mockDataFactory.getMockBranches(),
      mockFields: this.mockDataFactory.getMockFields()
    };
  }
} 