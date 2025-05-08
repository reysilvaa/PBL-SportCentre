// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/services/database';
import { config } from '../config/app/env';
import { getAuthToken } from '../utils/auth.utils';
import { isTokenBlacklisted } from '../utils/auth.utils';
import { verifyToken } from '../utils/jwt.utils';

/**
 * Middleware Autentikasi & Otorisasi Terpadu
 * Menggabungkan fungsionalitas dari:
 * - auth.middleware.ts
 * - adminBranch.middleware.ts
 * - role.middleware.ts
 * - permission.middleware.ts
 */

// Interface untuk tipe User dengan informasi cabang
export interface User extends Request {
  user?: {
    id: number;
    role: string;
  };
  userBranch?: {
    id: number;
    name: string;
    location: string;
    ownerId: number;
    status: string;
    createdAt: Date;
  };
}

// Opsi untuk konfigurasi middleware Auth
export interface AuthOptions {
  // Daftar role yang diizinkan mengakses endpoint
  allowedRoles?: string[];
  // Jika true, middleware akan mencari dan melampirkan cabang terkait ke request
  attachBranch?: boolean;
  // Fungsi opsional untuk pemeriksaan tambahan
  customCheck?: (req: User, res: Response) => Promise<boolean>;
  // Jika true, hanya pemilik data yang bisa mengakses (cek userId pada resource)
  ownerOnly?: boolean;
  // Nama model untuk pesan error saat pengecekan kepemilikan
  resourceName?: string;
}

// Handler tipe untuk controller yang diautentikasi
export type AuthenticatedRequestHandler = RequestHandler<
  any,
  any,
  any,
  any,
  { user?: { id: number; role: string } }
>;

/**
 * Middleware utama untuk otentikasi dan otorisasi
 * Menggabungkan fungsionalitas auth, role, dan branch middleware
 */
export const auth = (options: AuthOptions = {}) => {
  return async (req: User, res: Response, next: NextFunction): Promise<void> => {
    try {
      // BAGIAN 1: AUTENTIKASI - Dari auth.middleware.ts
      // Coba ambil token dari header Authorization
      const headerToken = req.header('Authorization')?.split(' ')[1];

      // Coba ambil token dari cookie
      const cookieToken = getAuthToken(req);

      // Gunakan token dari cookie jika ada, atau dari header jika tidak ada di cookie
      const token = cookieToken || headerToken;

      if (!token) {
        res.status(401).json({
          status: false,
          message: 'Unauthorized: Token tidak ditemukan',
        });
        return;
      }

      // Periksa jika token ada di blacklist
      const isBlacklisted = await isTokenBlacklisted(token);
      if (isBlacklisted) {
        res.status(401).json({
          status: false,
          message: 'Unauthorized: Token telah dicabut atau tidak valid',
        });
        return;
      }

      // Verifikasi token
      try {
        const decodedToken = verifyToken(token);
        
        if (!decodedToken) {
          res.status(401).json({
            status: false,
            message: 'Unauthorized: Token tidak valid',
          });
          return;
        }
        
        req.user = decodedToken as {
          id: number;
          role: string;
        };
      } catch (error) {
        // Jika token tidak valid karena expired, tambahkan pesan khusus
        if (error instanceof jwt.TokenExpiredError) {
          res.status(401).json({
            status: false,
            message: 'Unauthorized: Token telah kedaluwarsa',
            code: 'TOKEN_EXPIRED',
          });
          return;
        }

        res.status(401).json({
          status: false,
          message: 'Unauthorized: Token tidak valid',
        });
        return;
      }

      // BAGIAN 2: PEMERIKSAAN ROLE - Dari role.middleware.ts dan auth.middleware.ts
      const { allowedRoles = [] } = options;
      
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          status: false,
          message: `Forbidden: Resource ini hanya dapat diakses oleh ${allowedRoles.join(', ')}`,
        });
        return;
      }

      // BAGIAN 3: SUPER ADMIN BYPASS - Dari permission.middleware.ts
      // Super admin mendapatkan akses istimewa jika diperlukan
      if (req.user.role === 'super_admin' && options.attachBranch) {
        // Berikan branch dummy untuk super admin
        req.userBranch = {
          id: 0, // Id 0 untuk menandakan akses super admin
          name: 'All Branches',
          location: 'Global',
          ownerId: 0,
          status: 'active',
          createdAt: new Date(),
        };
        
        // Jika super admin, skip pemeriksaan cabang dan lanjut
        if (!options.ownerOnly && !options.customCheck) {
          next();
          return;
        }
      }

      // BAGIAN 4: PEMERIKSAAN BRANCH - Dari adminBranch.middleware.ts dan permission.middleware.ts
      if (options.attachBranch && req.user.role !== 'super_admin') {
        let branch = null;

        if (req.user.role === 'owner_cabang') {
          // Jika owner, dapatkan cabang yang dimiliki
          branch = await prisma.branch.findFirst({
            where: {
              ownerId: req.user.id,
              status: 'active',
            },
          });
        } else if (req.user.role === 'admin_cabang') {
          // Jika admin, dapatkan cabang melalui relasi BranchAdmin
          const branchAdmin = await prisma.branchAdmin.findFirst({
            where: {
              userId: req.user.id,
            },
            include: {
              branch: true,
            },
          });

          // Periksa status cabang aktif
          if (branchAdmin?.branch && branchAdmin.branch.status === 'active') {
            branch = branchAdmin.branch;
          }
        }

        if (!branch) {
          res.status(403).json({
            status: false,
            message: 'Forbidden: Anda tidak terkait dengan cabang aktif manapun',
          });
          return;
        }

        // Lampirkan informasi cabang ke request
        req.userBranch = branch;
      }

      // BAGIAN 5: PEMERIKSAAN KEPEMILIKAN RESOURCE - Dari role.middleware.ts
      if (options.ownerOnly) {
        const { id } = req.params;
        const resourceType = options.resourceName || 'resource';
        
        if (id && req.user.role !== 'super_admin') {
          // Di sini perlu implementasi spesifik untuk masing-masing model/resource
          // Namun ini adalah pola umum yang bisa digunakan
          try {
            const resourceId = parseInt(id);
            
            // Contoh implementasi untuk booking - perlu disesuaikan per resource
            const isOwner = await checkResourceOwnership(resourceType, resourceId, req.user.id);
            
            if (!isOwner) {
              res.status(403).json({
                status: false,
                message: `Forbidden: Anda tidak memiliki akses ke ${resourceType} ini`,
              });
              return;
            }
          } catch (error) {
            console.error(`Error checking ownership for ${resourceType}:`, error);
            res.status(500).json({
              status: false,
              message: 'Terjadi kesalahan saat memeriksa akses',
            });
            return;
          }
        }
      }

      // BAGIAN 6: PEMERIKSAAN KUSTOM - Dari permission.middleware.ts
      if (options.customCheck) {
        const isAllowed = await options.customCheck(req, res);
        if (!isAllowed) {
          return; // Response error sudah ditangani dalam customCheck
        }
      }

      // Lolos semua pemeriksaan
      next();
    } catch (error) {
      console.error('Error in auth middleware:', error);
      res.status(500).json({
        status: false,
        message: 'Internal Server Error',
      });
    }
  };
};

// Fungsi helper untuk pemeriksaan kepemilikan resource
// Implementasi spesifik untuk tiap jenis resource
async function checkResourceOwnership(
  resourceType: string,
  resourceId: number,
  userId: number
): Promise<boolean> {
  switch (resourceType.toLowerCase()) {
    case 'booking':
      const booking = await prisma.booking.findUnique({
        where: { id: resourceId },
      });
      return booking?.userId === userId;
    
    case 'field':
      // Untuk field, cek apakah user adalah admin/owner dari branch yang memiliki field
      const field = await prisma.field.findUnique({
        where: { id: resourceId },
        include: { branch: true },
      });
      
      if (!field) return false;
      
      // Cek owner
      if (field.branch.ownerId === userId) return true;
      
      // Cek admin
      const isAdmin = await prisma.branchAdmin.findFirst({
        where: {
          branchId: field.branchId,
          userId: userId,
        },
      });
      
      return !!isAdmin;
    
    case 'branch':
      const branch = await prisma.branch.findUnique({
        where: { id: resourceId },
      });
      
      // Cek owner
      if (branch?.ownerId === userId) return true;
      
      // Cek admin
      const branchAdmin = await prisma.branchAdmin.findFirst({
        where: {
          branchId: resourceId,
          userId: userId,
        },
      });
      
      return !!branchAdmin;
    
    // Tambahkan kasus lain sesuai kebutuhan
    
    default:
      // Default untuk resource yang tidak dikenal
      return false;
  }
}

// Shortcut functions untuk kemudahan penggunaan

// Auth untuk super admin
export const superAdminAuth = (customOptions: Partial<AuthOptions> = {}) => {
  return auth({
    allowedRoles: ['super_admin'],
    ...customOptions,
  });
};

// Auth untuk admin cabang
export const branchAdminAuth = (customOptions: Partial<AuthOptions> = {}) => {
  return auth({
    allowedRoles: ['admin_cabang'],
    attachBranch: true,
    ...customOptions,
  });
};

// Auth untuk owner cabang
export const ownerAuth = (customOptions: Partial<AuthOptions> = {}) => {
  return auth({
    allowedRoles: ['owner_cabang'],
    attachBranch: true,
    ...customOptions,
  });
};

// Auth untuk user
export const userAuth = (customOptions: Partial<AuthOptions> = {}) => {
  return auth({
    allowedRoles: ['user'],
    ...customOptions,
  });
};

// Middleware untuk memeriksa branch
export const withBranch = (customOptions: Partial<AuthOptions> = {}) => {
  return auth({
    attachBranch: true,
    ...customOptions,
  });
};
