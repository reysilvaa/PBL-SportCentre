import { Response } from 'express';

/**
 * Memvalidasi rentang tanggal untuk laporan
 */
export const validateDateRange = (
  startDate: string,
  endDate: string,
  res: Response
): boolean => {
  if (!startDate || !endDate) {
    res.status(400).json({
      status: false,
      message: 'Parameter startDate dan endDate harus disediakan',
    });
    return false;
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        status: false,
        message: 'Format tanggal tidak valid',
      });
      return false;
    }

    if (end < start) {
      res.status(400).json({
        status: false,
        message: 'endDate tidak boleh sebelum startDate',
      });
      return false;
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      res.status(400).json({
        status: false,
        message: 'Rentang waktu maksimal adalah 1 tahun',
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating date range:', error);
    res.status(400).json({
      status: false,
      message: 'Format tanggal tidak valid',
    });
    return false;
  }
};

/**
 * Validasi parameter untuk report
 */
export const validateReportParams = (
  type: string,
  res: Response
): boolean => {
  const validTypes = ['daily', 'monthly', 'yearly'];
  
  if (!type || !validTypes.includes(type)) {
    res.status(400).json({
      status: false,
      message: `Parameter type harus berupa salah satu dari: ${validTypes.join(', ')}`,
    });
    return false;
  }

  return true;
}; 