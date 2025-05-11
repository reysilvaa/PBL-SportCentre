import { RequestHandler } from 'express';

export const logger: RequestHandler = (req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url} ${
      req.ip
    } - User-Agent: ${req.headers['user-agent']}`
  );
  next();
};
