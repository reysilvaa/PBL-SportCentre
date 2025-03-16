import { Request, Response } from 'express';
import prisma from '../config/database';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { registerSchema, loginSchema } from '../zod-schemas/auth.schema';
import { hashPassword, verifyPassword } from '../utils/password.utils';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = registerSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({ 
        error: 'Validasi gagal', 
        details: result.error.format() 
      });
      return;
    }

    const { email, password, name, role } = result.data;

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      res.status(409).json({ error: 'Email sudah terdaftar' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role
      }
    });

    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = loginSchema.safeParse(req.body);
    
    if (!result.success) {
      res.status(400).json({ 
        error: 'Validasi gagal', 
        details: result.error.format() 
      });
      return;
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      res.status(401).json({ error: 'Email atau password salah' });
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Email atau password salah' });
      return;
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role
      }, 
      config.jwtSecret, 
      { expiresIn: '1h' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const logout = (req: Request, res: Response): void => {
  res.json({ message: 'Logout berhasil' });
};
