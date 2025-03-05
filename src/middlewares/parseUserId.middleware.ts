import { Request, Response, NextFunction } from 'express';

export const parseUserId = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body.userId) {
    const parsedId = parseInt(req.body.userId, 10);
    if (isNaN(parsedId)) {
      res.status(400).json({ error: 'userId must be a valid integer' });
      return; // ✅ Pastikan return untuk menghentikan eksekusi di sini
    }
    req.body.userId = parsedId;
  }
  next(); // ✅ Pastikan next() tetap dipanggil jika tidak ada error
};
