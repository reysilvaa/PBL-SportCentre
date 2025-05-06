import { Request, Response, NextFunction } from 'express';
import { User } from './auth.middleware';

/**
 * Middleware untuk memeriksa peran pengguna dan mengarahkan ke controller yang sesuai
 * @param controllers - Object berisi controller untuk tiap role
 * @returns Middleware
 */
export const roleBasedController = (controllers: {
  all?: (req: Request, res: Response, next: NextFunction) => void;
  superAdmin?: (req: Request, res: Response, next: NextFunction) => void;
  branchAdmin?: (req: Request, res: Response, next: NextFunction) => void;
  owner?: (req: Request, res: Response, next: NextFunction) => void;
  user?: (req: Request, res: Response, next: NextFunction) => void;
  [key: string]: any;
}) => {
  return (req: User, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole) {
      // Jika tidak ada role, gunakan controller untuk 'all' jika ada
      if (controllers.all) {
        controllers.all(req, res, next);
        return;
      }

      res.status(401).json({
        status: false,
        message: 'Unauthorized: Tidak ada informasi peran pengguna',
      });
      return;
    }

    // Map peran ke kunci controller
    const controllerKey =
      userRole === 'super_admin'
        ? 'superAdmin'
        : userRole === 'admin_cabang'
          ? 'branchAdmin'
          : userRole === 'owner_cabang'
            ? 'owner'
            : userRole === 'user'
              ? 'user'
              : null;

    // Jika ada controller untuk peran pengguna, gunakan itu
    if (controllerKey && controllers[controllerKey]) {
      controllers[controllerKey](req, res, next);
      return;
    }

    // Jika tidak ada controller spesifik untuk peran tersebut, coba gunakan controller 'all'
    if (controllers.all) {
      controllers.all(req, res, next);
      return;
    }

    // Jika tidak ada controller yang cocok, kembalikan forbidden
    res.status(403).json({
      status: false,
      message: 'Forbidden: Anda tidak memiliki izin untuk akses ini',
    });
  };
};

/**
 * Middleware untuk memeriksa apakah pengguna memiliki akses ke cabang tertentu
 * @param paramName - Nama parameter yang berisi ID cabang
 * @returns Middleware
 */
export const branchAccessCheck = (paramName: string = 'branchId') => {
  return async (
    req: User,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!userRole || !userId) {
      res.status(401).json({
        status: false,
        message: 'Unauthorized: Informasi pengguna tidak lengkap',
      });
      return;
    }

    const branchId = parseInt(req.params[paramName], 10);

    if (isNaN(branchId)) {
      res.status(400).json({
        status: false,
        message: `Parameter ${paramName} tidak valid`,
      });
      return;
    }

    // Super admin selalu memiliki akses
    if (userRole === 'super_admin') {
      next();
      return;
    }

    try {
      // Logika untuk memeriksa apakah user adalah admin atau owner cabang tertentu
      // Implementasi tergantung pada struktur database dan repository yang ada

      // Untuk admin_cabang, periksa apakah ia adalah admin untuk branch ini
      if (userRole === 'admin_cabang') {
        // Implementasi menggunakan repository yang sudah ada
        // Contoh: const isAdmin = await branchRepository.isUserAdminOfBranch(userId, branchId);
        const isAdmin = true; // Placeholder, ganti dengan implementasi sebenarnya

        if (isAdmin) {
          next();
          return;
        }
      }

      // Untuk owner_cabang, periksa apakah ia adalah pemilik branch ini
      if (userRole === 'owner_cabang') {
        // Implementasi menggunakan repository yang sudah ada
        // Contoh: const isOwner = await branchRepository.isUserOwnerOfBranch(userId, branchId);
        const isOwner = true; // Placeholder, ganti dengan implementasi sebenarnya

        if (isOwner) {
          next();
          return;
        }
      }

      // Jika sampai di sini, berarti user tidak memiliki akses
      res.status(403).json({
        status: false,
        message: 'Forbidden: Anda tidak memiliki akses ke cabang ini',
      });
    } catch (error) {
      console.error('Error in branchAccessCheck:', error);
      res.status(500).json({
        status: false,
        message: 'Terjadi kesalahan saat memeriksa akses cabang',
      });
    }
  };
};

/**
 * Middleware untuk memeriksa akses ke resource berdasarkan kepemilikan
 * @param modelType - Tipe model yang akan diperiksa ('booking', 'field', dll)
 * @param paramName - Nama parameter yang berisi ID resource
 * @returns Middleware
 */
export const resourceOwnershipCheck = (
  modelType: string,
  paramName: string = 'id'
) => {
  return async (
    req: User,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!userRole || !userId) {
      res.status(401).json({
        status: false,
        message: 'Unauthorized: Informasi pengguna tidak lengkap',
      });
      return;
    }

    const resourceId = parseInt(req.params[paramName], 10);

    if (isNaN(resourceId)) {
      res.status(400).json({
        status: false,
        message: `Parameter ${paramName} tidak valid`,
      });
      return;
    }

    // Super admin selalu memiliki akses
    if (userRole === 'super_admin') {
      next();
      return;
    }

    try {
      // Logika untuk memeriksa kepemilikan resource
      // Implementasi tergantung pada struktur database dan repository yang ada

      // Contoh untuk booking:
      // const isOwner = await bookingRepository.isUserOwnerOfBooking(userId, resourceId);

      // Placeholder, ganti dengan implementasi sebenarnya
      const isOwner = true;

      if (isOwner) {
        next();
        return;
      }

      // Jika sampai di sini, berarti user tidak memiliki akses
      res.status(403).json({
        status: false,
        message: `Forbidden: Anda tidak memiliki akses ke ${modelType} ini`,
      });
    } catch (error) {
      console.error(`Error in resourceOwnershipCheck for ${modelType}:`, error);
      res.status(500).json({
        status: false,
        message: `Terjadi kesalahan saat memeriksa akses ${modelType}`,
      });
    }
  };
};
