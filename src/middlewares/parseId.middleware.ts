import { Request, Response, NextFunction } from 'express';

export const parseIds = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const parseIntegerField = (field: string) => {
    if (req.body[field]) {
      const parsedId = parseInt(req.body[field], 10);
      if (isNaN(parsedId)) {
        res.status(400).json({ error: `${field} must be a valid integer` });
        return false; // Hentikan jika gagal
      }
      req.body[field] = parsedId;
    }
    return true;
  };

  if (!parseIntegerField('userId')) return;
  if (!parseIntegerField('ownerId')) return;
  if (!parseIntegerField('fieldId')) return;
  if (!parseIntegerField('branchId')) return;
  if (!parseIntegerField('typeId')) return;
  if (!parseIntegerField('rating')) return;

  next();
};
