import express from 'express';
import { login, logout, register } from '../../controllers/auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = express.Router();

router.use(express.urlencoded({ extended: true }));

router.post('/login', login);
router.post('/register', register);
router.post('/logout', authMiddleware(), logout);

export default router;
