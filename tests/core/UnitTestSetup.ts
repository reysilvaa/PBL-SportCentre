import { TestSetup } from './TestSetup';
import { MockDataFactory } from './MockDataFactory';
import { jest } from '@jest/globals';

export class UnitTestSetup extends TestSetup {
  protected static instance: UnitTestSetup;
  private mockDataFactory: MockDataFactory;

  private constructor() {
    super();
    this.mockDataFactory = MockDataFactory.getInstance();
  }

  public static getInstance(): UnitTestSetup {
    if (!UnitTestSetup.instance) {
      UnitTestSetup.instance = new UnitTestSetup();
    }
    return UnitTestSetup.instance;
  }

  // Setup untuk pengujian unit controller
  public setupControllerTest() {
    // Setup semua mock dasar
    this.setupAllMocks();
    
    // Mock prisma untuk controller test
    const prismaMock = this.mockDataFactory.setupPrismaMocks();
    
    // Mock database service
    jest.mock('../../src/config/services/database', () => {
      return {
        __esModule: true,
        default: prismaMock,
      };
    });
    
    return {
      prismaMock,
      mockUsers: this.mockDataFactory.getMockUsers(),
      mockBranches: this.mockDataFactory.getMockBranches(),
      mockFields: this.mockDataFactory.getMockFields(),
      mockTokens: this.mockDataFactory.getMockTokens()
    };
  }
  
  // Setup untuk pengujian unit utilities
  public setupUtilsTest() {
    // Setup mock yang diperlukan saja
    this.setupConfigMock();
    this.setupRedisMock();
    this.setupTimezoneUtilsMock();
    this.setupConsoleMock();
    
    return {
      mockUsers: this.mockDataFactory.getMockUsers(),
      mockTokens: this.mockDataFactory.getMockTokens()
    };
  }
} 