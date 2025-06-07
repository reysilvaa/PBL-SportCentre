import express from 'express';
import { forgotPassword, login, logout, register, refreshToken, getAuthStatus, resetPassword } from '../../controllers/auth.controller';
import { auth } from '../../middlewares/auth.middleware';
import { loginRateLimiter, registerRateLimiter } from '../../middlewares/security.middleware';

const router = express.Router();

router.use(express.urlencoded({ extended: true }));

router.post('/login', loginRateLimiter, login);
router.post('/register', registerRateLimiter, register);
router.post('/logout', auth(), logout);
router.post('/refresh-token', refreshToken);
router.get('/status', getAuthStatus);
router.post('/forgot-password', loginRateLimiter, forgotPassword);
router.post('/reset-password', loginRateLimiter, resetPassword);

export default router;
