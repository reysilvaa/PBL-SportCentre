import { TestSetup } from './TestSetup';
import { MockDataFactory } from './MockDataFactory';
import express, { Express } from 'express';
import supertest from 'supertest';
import cookieParser from 'cookie-parser';

export class E2ETestSetup extends TestSetup {
  protected static instance: E2ETestSetup;
  private mockDataFactory: MockDataFactory;
  private app: Express;

  private constructor() {
    super();
    this.mockDataFactory = MockDataFactory.getInstance();
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser('test_secret'));
  }

  public static getInstance(): E2ETestSetup {
    if (!E2ETestSetup.instance) {
      E2ETestSetup.instance = new E2ETestSetup();
    }
    return E2ETestSetup.instance;
  }

  /**
   * Menyiapkan aplikasi express untuk pengujian E2E
   * @param apiRouter Router API yang akan diuji
   * @returns Express app yang sudah dikonfigurasi
   */
  public setupE2ETest(apiRouter: any) {
    // Setup semua mock dasar
    this.setupAllMocks();
    
    // Gunakan router yang disediakan
    this.app.use('/api', apiRouter);
    
    // Setup mock routes dasar untuk pengujian non-router
    this.setupBasicRoutes();
    
    return {
      app: this.app,
      request: supertest(this.app),
      requestWithAuth: this.requestWithAuth.bind(this, this.app),
      createAuthHeaders: this.createAuthHeaders.bind(this),
      mockTokens: this.mockDataFactory.getMockTokens()
    };
  }
  
  private setupBasicRoutes() {
    // Rute untuk field endpoint (contoh)
    this.app.get('/fields', (_req, res) => {
      const fields = this.mockDataFactory.getMockFields();
      res.status(200).json({
        data: fields,
        meta: {
          totalItems: fields.length,
          page: 1,
          limit: 10,
          totalPages: 1
        }
      });
    });

    // Endpoint detail lapangan
    this.app.get('/fields/:id', (req, res) => {
      const id = parseInt(req.params.id);
      const field = this.mockDataFactory.getMockFields().find(f => f.id === id);
      
      if (field) {
        res.status(200).json({
          ...field,
          branch: this.mockDataFactory.getMockBranches().find(b => b.id === field.branchId),
          type: this.mockDataFactory.getMockFieldTypes().find(t => t.id === field.typeId)
        });
      } else {
        res.status(404).json({
          status: false,
          message: 'Lapangan tidak ditemukan'
        });
      }
    });

    // Endpoint lapangan per cabang
    this.app.get('/branches/:id/fields', (req, res) => {
      const branchId = parseInt(req.params.id);
      const branch = this.mockDataFactory.getMockBranches().find(b => b.id === branchId);
      
      if (branch) {
        const fields = this.mockDataFactory.getMockFields().filter(f => f.branchId === branchId);
        res.status(200).json(fields);
      } else {
        res.status(404).json({
          status: false,
          message: 'Cabang tidak ditemukan'
        });
      }
    });
  }
} 