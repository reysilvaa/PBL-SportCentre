import { Request, Response, NextFunction } from 'express';

export function validateDateMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const { bookingDate, startTime, endTime } = req.body;

    // Validasi bookingDate
    if (bookingDate && isNaN(Date.parse(bookingDate))) {
      res.status(400).json({
        error: 'Invalid date format',
        field: 'bookingDate',
        message: 'bookingDate must be a valid date string (YYYY-MM-DD)',
      });
      return;
    }

    // Validasi format jam HH:MM
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      res.status(400).json({
        error: 'Invalid time format',
        message: 'startTime and endTime must be in HH:MM format',
      });
      return;
    }

    // Konversi bookingDate ke Date object setelah validasi
    if (bookingDate) req.body.bookingDate = new Date(bookingDate);

    next();
  } catch (error) {
    next(error);
  }
}
