// src/controllers/authController.ts
import { Request, Response } from 'express';
import prisma from '../config/database';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/env';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Log entire request body for debugging
    console.log('Full Request Body:', JSON.stringify(req.body, null, 2));

    // Extract values with optional chaining and provide default empty strings
    const email = req.body?.email ?? '';
    const password = req.body?.password ?? '';
    const name = req.body?.name ?? '';
    const role = req.body?.role ?? 'user';

    // Validate input with more detailed logging
    const validationErrors: Record<string, boolean> = {
      email: email.trim().length > 0,
      password: password.trim().length > 0,
      name: name.trim().length > 0
    };

    const hasErrors = Object.values(validationErrors).some(value => !value);

    if (hasErrors) {
      console.error('Registration Validation Failed', {
        email: validationErrors.email,
        password: validationErrors.password,
        name: validationErrors.name
      });

      res.status(400).json({ 
        error: 'Email, password, and name are required',
        details: validationErrors
      });
      return;
    }

    // Rest of the registration logic remains the same...
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
        role: role as 'user' | 'admin_cabang' | 'owner_cabang' | 'super_admin'
      }
    });

    // Exclude password from response
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

// Similar modifications for login method...
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Full Login Request Body:', JSON.stringify(req.body, null, 2));

    const email = req.body?.email ?? '';
    const password = req.body?.password ?? '';

    const validationErrors: Record<string, boolean> = {
      email: email.trim().length > 0,
      password: password.trim().length > 0
    };

    const hasErrors = Object.values(validationErrors).some(value => !value);

    if (hasErrors) {
      console.error('Login Validation Failed', validationErrors);
      res.status(400).json({ 
        error: 'Email and password are required',
        details: validationErrors
      });
      return;
    }

    // Rest of login logic remains the same...
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
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
  res.json({ message: 'Logout successful' });
};