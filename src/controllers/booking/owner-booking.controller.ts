// import { Response } from 'express';
// import { User } from '../../middlewares/auth.middleware';
// import * as RevenueService from '../../repositories/revenue/revenueReports.service';
// import { validateDateRange } from '../../repositories/revenue/validation.utils';

// /**
//  * Owner Booking Controller
//  * Berisi semua operasi laporan dan statistik terkait booking yang dapat diakses owner
//  */

// export const getRevenueReports = async (
//   req: User,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { startDate, endDate, type } = req.query;
//     const branchId = req.userBranch?.id;

//     if (!validateDateRange(startDate as string, endDate as string, res)) return;

//     const start = new Date(startDate as string);
//     const end = new Date(endDate as string);

//     // Owner hanya bisa melihat data cabang mereka sendiri
//     // Super admin bisa melihat data semua cabang atau pilih specific branch
//     const targetBranchId = req.user?.role === 'super_admin' && req.query.branchId
//       ? parseInt(req.query.branchId as string)
//       : branchId;

//     const result = await RevenueService.generateRevenueReport(
//       start,
//       end,
//       type as string,
//       targetBranchId !== 0 ? targetBranchId : undefined
//     );
    
//     res.status(200).json({
//       status: true,
//       message: 'Berhasil mendapatkan laporan pendapatan',
//       data: result
//     });
//   } catch (error) {
//     console.error('Error getting revenue reports:', error);
//     res.status(500).json({ 
//       status: false,
//       message: 'Internal Server Error' 
//     });
//   }
// };

// export const getOccupancyReports = async (
//   req: User,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { startDate, endDate } = req.query;
//     const branchId = req.userBranch?.id;

//     if (!validateDateRange(startDate as string, endDate as string, res)) return;

//     const start = new Date(startDate as string);
//     const end = new Date(endDate as string);
    
//     // Owner hanya bisa melihat data cabang mereka sendiri
//     // Super admin bisa melihat data semua cabang atau pilih specific branch
//     const targetBranchId = req.user?.role === 'super_admin' && req.query.branchId
//       ? parseInt(req.query.branchId as string)
//       : branchId;

//     const result = await RevenueService.generateOccupancyReport(
//       start,
//       end,
//       targetBranchId !== 0 ? targetBranchId : undefined
//     );
    
//     res.status(200).json({
//       status: true,
//       message: 'Berhasil mendapatkan laporan okupansi',
//       data: result
//     });
//   } catch (error) {
//     console.error('Error getting occupancy reports:', error);
//     res.status(500).json({ 
//       status: false,
//       message: 'Internal Server Error' 
//     });
//   }
// };

// export const getBusinessPerformance = async (
//   req: User,
//   res: Response
// ): Promise<void> => {
//   try {
//     const branchId = req.userBranch?.id;

//     // Get branch-specific performance for owners
//     const result = await RevenueService.generateBusinessPerformanceReport(
//       branchId !== 0 ? branchId : undefined
//     );
    
//     res.status(200).json({
//       status: true,
//       message: 'Berhasil mendapatkan laporan performa bisnis',
//       data: result
//     });
//   } catch (error) {
//     console.error('Error getting business performance:', error);
//     res.status(500).json({ 
//       status: false,
//       message: 'Internal Server Error' 
//     });
//   }
// };

// export const getBookingForecast = async (
//   req: User,
//   res: Response
// ): Promise<void> => {
//   try {
//     const branchId = req.userBranch?.id;

//     // Get branch-specific forecast for owners
//     const result = await RevenueService.generateBookingForecast(
//       branchId !== 0 ? branchId : undefined
//     );
    
//     res.status(200).json({
//       status: true,
//       message: 'Berhasil mendapatkan prediksi booking',
//       data: result
//     });
//   } catch (error) {
//     console.error('Error getting booking forecast:', error);
//     res.status(500).json({ 
//       status: false,
//       message: 'Internal Server Error' 
//     });
//   }
// }; 