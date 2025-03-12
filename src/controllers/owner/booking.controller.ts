import { Request, Response } from 'express';
import * as RevenueService from '../../repositories/revenue/revenueReports.service';
import { validateDateRange } from '../../repositories/revenue/validation.utils';

export const getRevenueReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, type } = req.query;
    
    if (!validateDateRange(startDate as string, endDate as string, res)) return;
    
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    const result = await RevenueService.generateRevenueReport(start, end, type as string);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getOccupancyReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, branchId } = req.query;
    
    if (!validateDateRange(startDate as string, endDate as string, res)) return;
    
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const branch = branchId ? parseInt(branchId as string) : undefined;
    
    const result = await RevenueService.generateOccupancyReport(start, end, branch);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getBusinessPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await RevenueService.generateBusinessPerformanceReport();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getBookingForecast = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await RevenueService.generateBookingForecast();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};