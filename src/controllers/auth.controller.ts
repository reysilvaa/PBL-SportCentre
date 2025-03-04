// src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/env';

export interface LoginRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

export interface RegisterRequest extends Request {
  body: {
    email: string;
    password: string;
    name: string;
    role?: 'super_admin' | 'admin_cabang' | 'owner_cabang' | 'user';
  };
}

export const login = async (req: LoginRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // Check if user exists
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role
      }, 
      config.jwtSecret, 
      { expiresIn: '1h' }
    );

    // Exclude password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const logout = (req: Request, res: Response): void => {
  // In a JWT-based authentication system, logout is typically handled client-side
  // by removing the token. However, we can add some additional logic if needed.
  res.json({ message: 'Logout successful' });
};

export const register = async (req: RegisterRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;

    // Validate input
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'user' // Default to 'user' role if not specified
      }
    });

    // Exclude password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};