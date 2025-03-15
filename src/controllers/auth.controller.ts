import { Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import prisma from '../config/database';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { RegisterDto } from '../dto/auth/register.dto';
import { LoginDto } from '../dto/auth/login.dto';
import { hashPassword, verifyPassword } from '../utils/password.utils';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const registerDto = plainToClass(RegisterDto, req.body);
    const validationErrors = await validate(registerDto);

    if (validationErrors.length > 0) {
      const errors = validationErrors.map(error => ({
        property: error.property,
        constraints: error.constraints
      }));

      res.status(400).json({ 
        error: 'Validation Failed',
        details: errors 
      });
      return;
    }

    const { email, password, name, role } = registerDto;

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role ?? 'user'
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
    const loginDto = plainToClass(LoginDto, req.body);
    const validationErrors = await validate(loginDto);

    if (validationErrors.length > 0) {
      const errors = validationErrors.map(error => ({
        property: error.property,
        constraints: error.constraints
      }));

      res.status(400).json({ 
        error: 'Validation Failed',
        details: errors 
      });
      return;
    }

    const { email, password } = loginDto;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.password);
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
