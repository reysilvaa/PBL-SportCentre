import express from 'express';
import {
  login,
  logout,
  register,
  refreshToken,
} from '../../controllers/auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  loginRateLimiter,
  registerRateLimiter,
} from '../../middlewares/security.middleware';

const router = express.Router();

router.use(express.urlencoded({ extended: true }));

router.post('/login', loginRateLimiter, login);
router.post('/register', register);
router.post('/logout', authMiddleware(), logout);
router.post('/refresh-token', refreshToken);

export default router;
