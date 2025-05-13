import { Router } from 'express';
import { getDashboardStats } from '../../controllers/dashboard/statistics.controller';
import { auth } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/dashboard/stats:
 *  get:
 *    tags:
 *      - Dashboard
 *    summary: Mendapatkan statistik dashboard
 *    description: Endpoint untuk mendapatkan statistik dashboard berdasarkan role user (SuperAdmin, OwnerCabang, AdminCabang, User) dan periode waktu
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: query
 *        name: period
 *        schema:
 *          type: string
 *          enum: [daily, monthly, yearly]
 *        description: Periode waktu untuk data statistik (default: monthly)
 *    responses:
 *      200:
 *        description: Data statistik dashboard berhasil diambil
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *      401:
 *        description: Unauthorized - Token tidak valid atau user tidak terautentikasi
 *      500:
 *        description: Server error
 */
router.get('/stats', auth(), getDashboardStats);


export default router; 