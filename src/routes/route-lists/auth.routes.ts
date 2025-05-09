import express from 'express';
import { login, logout, register, refreshToken, getAuthStatus } from '../../controllers/auth.controller';
import { auth } from '../../middlewares/auth.middleware';
import { loginRateLimiter } from '../../middlewares/security.middleware';

const router = express.Router();

router.use(express.urlencoded({ extended: true }));

router.post('/login', loginRateLimiter, login);
// router.post('/register', registerRateLimiter, register);
router.post('/register', register);
router.post('/logout', auth(), logout);
router.post('/refresh-token', refreshToken);
router.get('/status', getAuthStatus);

export default router;
