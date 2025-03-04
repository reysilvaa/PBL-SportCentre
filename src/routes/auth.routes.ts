// src/routes/authRoutes.ts
import express from 'express';
import { login, logout, register } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/logout', authMiddleware, logout);

export default router;