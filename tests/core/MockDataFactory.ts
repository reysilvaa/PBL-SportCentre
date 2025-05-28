// @ts-nocheck
import { Role, Branch, Field, FieldType, FieldStatus, BranchStatus, Prisma } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

export class MockDataFactory {
  private static instance: MockDataFactory;
  private prismaMock: DeepMockProxy<PrismaClient>;

  // Singleton pattern
  private constructor() {
    this.prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;
  }

  public static getInstance(): MockDataFactory {
    if (!MockDataFactory.instance) {
      MockDataFactory.instance = new MockDataFactory();
    }
    return MockDataFactory.instance;
  }

  // Getter untuk mock prisma client
  public getPrismaMock(): DeepMockProxy<PrismaClient> {
    return this.prismaMock;
  }

  // Data untuk user
  public getMockUsers() {
    return [
      {
        id: 1,
        email: 'admin@test.com',
        password: 'hashed_password123',
        name: 'Admin User',
        role: Role.super_admin,
        phone: '081234567890',
        createdAt: new Date(),
      },
      {
        id: 2,
        email: 'user@test.com',
        password: 'hashed_password123',
        name: 'Test User',
        role: Role.user,
        phone: '081234567891',
        createdAt: new Date(),
      },
      {
        id: 3,
        email: 'owner@test.com',
        password: 'hashed_password123',
        name: 'Owner User',
        role: Role.owner_cabang,
        phone: '081234567892',
        createdAt: new Date(),
      },
      {
        id: 4,
        email: 'branch_admin@test.com',
        password: 'hashed_password123',
        name: 'Branch Admin',
        role: Role.admin_cabang,
        phone: '081234567893',
        createdAt: new Date(),
      }
    ];
  }

  // Data untuk branches
  public getMockBranches(): Partial<Branch>[] {
    return [
      {
        id: 1,
        name: 'Branch 1',
        location: 'Location 1',
        ownerId: 3,
        status: BranchStatus.active,
        createdAt: new Date('2023-01-01T00:00:00Z'),
      },
      {
        id: 2,
        name: 'Branch 2',
        location: 'Location 2',
        ownerId: 3,
        status: BranchStatus.active,
        createdAt: new Date('2023-01-02T00:00:00Z'),
      },
    ];
  }

  // Data untuk field types
  public getMockFieldTypes(): Partial<FieldType>[] {
    return [
      {
        id: 1,
        name: 'Futsal',
      },
      {
        id: 2,
        name: 'Basketball',
      },
    ];
  }

  // Data untuk fields
  public getMockFields(): Partial<Field>[] {
    return [
      {
        id: 1,
        name: 'Futsal Field 1',
        branchId: 1,
        typeId: 1,
        priceDay: new Prisma.Decimal('100000'),
        priceNight: new Prisma.Decimal('150000'),
        status: FieldStatus.available,
        createdAt: new Date('2023-01-01T00:00:00Z'),
      },
      {
        id: 2,
        name: 'Basketball Court 1',
        branchId: 1,
        typeId: 2,
        priceDay: new Prisma.Decimal('120000'),
        priceNight: new Prisma.Decimal('180000'),
        status: FieldStatus.available,
        createdAt: new Date('2023-01-02T00:00:00Z'),
      },
    ];
  }

  // Token JWT untuk pengujian
  public getMockTokens() {
    return {
      validUserToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Miwicm9sZSI6InVzZXIiLCJuYW1lIjoiVGVzdCBVc2VyIiwicGVybWlzc2lvbnMiOlsicmVhZDpib29raW5ncyIsIndyaXRlOmJvb2tpbmdzIl0sImV4cCI6MjU0NTI1MzQzN30.mockSignature',
      validAdminToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6InN1cGVyX2FkbWluIiwibmFtZSI6IkFkbWluIFVzZXIiLCJwZXJtaXNzaW9ucyI6WyJhZG1pbjphbGwiXSwiZXhwIjoyNTQ1MjUzNDM3fQ.mockSignature',
      validOwnerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6Im93bmVyX2NhYmFuZyIsIm5hbWUiOiJPd25lciBVc2VyIiwicGVybWlzc2lvbnMiOlsicmVhZDpicmFuY2hlcyIsIndyaXRlOmJyYW5jaGVzIl0sImV4cCI6MjU0NTI1MzQzN30.mockSignature',
      validBranchAdminToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6ImFkbWluX2NhYmFuZyIsIm5hbWUiOiJCcmFuY2ggQWRtaW4iLCJwZXJtaXNzaW9ucyI6WyJyZWFkOmJyYW5jaCIsIndyaXRlOmJvb2tpbmdzIl0sImV4cCI6MjU0NTI1MzQzN30.mockSignature',
      expiredToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Miwicm9sZSI6InVzZXIiLCJuYW1lIjoiVGVzdCBVc2VyIiwicGVybWlzc2lvbnMiOlsicmVhZDpib29raW5ncyJdLCJleHAiOjE1MTYyMzkwMjJ9.mockSignature',
      invalidToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxNTE2MjM5MDIyfQ.mockSignature',
    };
  }

  // Menyiapkan mock untuk Prisma
  public setupPrismaMocks() {
    // Mock untuk user query
    this.prismaMock.user.findUnique.mockImplementation((args: any) => {
      const id = args.where?.id;
      const email = args.where?.email;
      
      if (id) {
        return Promise.resolve(this.getMockUsers().find(u => u.id === id) as any);
      } else if (email) {
        return Promise.resolve(this.getMockUsers().find(u => u.email === email) as any);
      }
      
      return Promise.resolve(null);
    });

    this.prismaMock.user.findMany.mockResolvedValue(this.getMockUsers() as any);
    
    // Mock untuk branch query
    this.prismaMock.branch.findUnique.mockImplementation((args: any) => {
      const id = args.where?.id;
      return Promise.resolve(this.getMockBranches().find(b => b.id === id) as any || null);
    });
    
    this.prismaMock.branch.findMany.mockResolvedValue(this.getMockBranches() as any);
    
    // Mock untuk field query
    this.prismaMock.field.findUnique.mockImplementation((args: any) => {
      const id = args.where?.id;
      return Promise.resolve(this.getMockFields().find(f => f.id === id) as any || null);
    });
    
    this.prismaMock.field.findMany.mockImplementation((args: any) => {
      const branchId = args.where?.branchId;
      const typeId = args.where?.typeId;
      
      let fields = [...this.getMockFields()];
      
      if (branchId) {
        fields = fields.filter(f => f.branchId === branchId);
      }
      
      if (typeId) {
        fields = fields.filter(f => f.typeId === typeId);
      }
      
      return Promise.resolve(fields as any);
    });
    
    this.prismaMock.fieldType.findMany.mockResolvedValue(this.getMockFieldTypes() as any);

    return this.prismaMock;
  }
} 