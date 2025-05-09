import { Response } from 'express';

/**
 * Validates that the provided start and end dates are valid and that start date is before end date
 * @param startDate - Start date string in YYYY-MM-DD format
 * @param endDate - End date string in YYYY-MM-DD format
 * @param res - Express Response object to send error if validation fails
 * @returns boolean indicating if validation passed
 */
export const validateDateRange = (startDate: string, endDate: string, res: Response): boolean => {
  // Check if dates are provided
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'Start date and end date are required' });
    return false;
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format' });
    return false;
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return false;
    }

    // Check if start date is before end date
    if (start > end) {
      res.status(400).json({ error: 'Start date must be before end date' });
      return false;
    }

    // Check if date range is not too large (optional, adjust as needed)
    const maxRangeDays = 365; // 1 year
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > maxRangeDays) {
      res.status(400).json({ error: `Date range cannot exceed ${maxRangeDays} days` });
      return false;
    }

    return true;
  } catch {
    res.status(400).json({ error: 'Invalid date format' });
    return false;
  }
};

/**
 * Validates that the provided ID is a positive integer
 * @param id - ID to validate
 * @param res - Express Response object to send error if validation fails
 * @param paramName - Name of the parameter being validated (for error message)
 * @returns boolean indicating if validation passed
 */
export const validateId = (
  id: string | undefined,
  res: Response,
  paramName: string = 'ID'
): boolean => {
  if (!id) {
    return true; // ID is optional
  }

  const parsedId = parseInt(id);

  if (isNaN(parsedId) || parsedId <= 0 || parsedId.toString() !== id) {
    res.status(400).json({ error: `${paramName} must be a positive integer` });
    return false;
  }

  return true;
};

/**
 * Validates pagination parameters
 * @param page - Page number
 * @param limit - Items per page
 * @param res - Express Response object to send error if validation fails
 * @returns boolean indicating if validation passed
 */
export const validatePagination = (
  page: string | undefined,
  limit: string | undefined,
  res: Response
): boolean => {
  if (!page && !limit) {
    return true; // Pagination is optional
  }

  const pageNum = page ? parseInt(page) : 1;
  const limitNum = limit ? parseInt(limit) : 10;

  if (isNaN(pageNum) || pageNum <= 0) {
    res.status(400).json({ error: 'Page must be a positive integer' });
    return false;
  }

  if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
    res.status(400).json({ error: 'Limit must be a positive integer between 1 and 100' });
    return false;
  }

  return true;
};

/**
 * Validates that a string parameter is not empty
 * @param value - String value to validate
 * @param res - Express Response object to send error if validation fails
 * @param paramName - Name of the parameter being validated (for error message)
 * @returns boolean indicating if validation passed
 */
export const validateRequiredString = (
  value: string | undefined,
  res: Response,
  paramName: string
): boolean => {
  if (!value || value.trim() === '') {
    res.status(400).json({ error: `${paramName} is required` });
    return false;
  }

  return true;
};
