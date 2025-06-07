import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/services/database';
import { config } from '../config/app/env';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../zod-schemas/auth.schema';
import {
  blacklistToken,
  setAuthCookie,
  setRefreshTokenCookie,
  clearAuthCookie,
  clearRefreshTokenCookie,
  getAuthToken,
  isTokenBlacklisted,
} from '../utils/auth.utils';
import { hashPassword, verifyPassword } from '../utils/password.utils';
import { verifyToken } from '../utils/jwt.utils';
import { sendPasswordResetEmail } from '../config/services/email';

// Fungsi untuk generate token
const generateTokens = (user: { id: number; email: string; role: string }) => {
  // Access token (masa aktif pendek)
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  // Refresh token (masa aktif panjang)
  const refreshToken = jwt.sign({ id: user.id }, config.jwtSecret, {
    expiresIn: '30d',
  });

  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const { email, password, name, role, phone } = result.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
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
        phone,
        role,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error',
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
        details: result.error.format(),
      });
      return;
    }

    const { email, password } = result.data;
    
    let user = await prisma.user.findUnique({
      where: { email },
    });
    
    // Jika tidak ditemukan dengan email, coba cari berdasarkan nomor telepon
    if (!user) {
      user = await prisma.user.findFirst({
        where: { phone: email }, // Gunakan field email untuk mencoba nomor telepon
      });
    }

    if (!user) {
      res.status(401).json({ error: 'Kredensial tidak valid' });
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Kredensial tidak valid' });
      return;
    }

    // Generate access dan refresh token
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Set cookies untuk authentication
    setAuthCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token: accessToken, // Tetap mengembalikan token untuk client yang tidak menggunakan cookies
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // Dapatkan token dari header atau cookie
    const headerToken = req.header('Authorization')?.split(' ')[1];
    const cookieToken = req.signedCookies['auth_token'];
    const refreshToken = req.signedCookies['refresh_token'];

    // Gunakan token yang tersedia
    const token = cookieToken || headerToken;

    // Jika token tersedia, tambahkan ke blacklist
    if (token) {
      try {
        // Decode token untuk mendapatkan waktu expired
        const decoded = verifyToken(token) as { exp: number };

        if (decoded) {
          // Hitung sisa waktu token (dalam detik)
          const now = Math.floor(Date.now() / 1000);
          const expiryInSeconds = decoded.exp - now;

          // Tambahkan token ke blacklist dengan waktu expired yang sama
          await blacklistToken(token, expiryInSeconds > 0 ? expiryInSeconds : undefined);
        }
      } catch (error) {
        console.error('Error adding token to blacklist:', error);
        // Lanjutkan meskipun ada error dalam menambahkan token ke blacklist
      }
    }

    // Tambahkan refresh token ke blacklist jika ada
    if (refreshToken) {
      try {
        // Decode refresh token untuk mendapatkan waktu expired
        const decoded = verifyToken(refreshToken) as { exp: number };

        if (decoded) {
          // Hitung sisa waktu token (dalam detik)
          const now = Math.floor(Date.now() / 1000);
          const expiryInSeconds = decoded.exp - now;

          // Tambahkan refresh token ke blacklist dengan waktu expired yang sama
          await blacklistToken(refreshToken, expiryInSeconds > 0 ? expiryInSeconds : undefined);
        }
      } catch (error) {
        console.error('Error adding refresh token to blacklist:', error);
      }
    }

    // Hapus cookies authentication
    clearAuthCookie(res);
    clearRefreshTokenCookie(res);

    res.json({ message: 'Logout berhasil' });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Endpoint untuk refresh token
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ambil refresh token dari cookies yang signed (ditandatangani)
    const refreshToken = req.signedCookies['refresh_token'];

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token tidak ditemukan' });
      return;
    }

    // Periksa jika token ada di blacklist
    const isBlacklisted = await isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      clearAuthCookie(res);
      clearRefreshTokenCookie(res);
      res.status(401).json({ error: 'Refresh token telah dicabut atau tidak valid' });
      return;
    }

    // Verifikasi refresh token
    try {
      const decoded = verifyToken(refreshToken) as {
        id: number;
      };

      if (!decoded) {
        clearAuthCookie(res);
        clearRefreshTokenCookie(res);
        res.status(401).json({ error: 'Refresh token tidak valid' });
        return;
      }

      // Cari user berdasarkan id dari token
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        res.status(401).json({ error: 'User tidak ditemukan' });
        return;
      }

      // Generate token baru
      const { accessToken, refreshToken: newRefreshToken } = generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      // Blacklist token lama sebelum memberikan token baru
      await blacklistToken(refreshToken);

      // Set cookies baru
      setAuthCookie(res, accessToken);
      setRefreshTokenCookie(res, newRefreshToken);

      const { password: _, ...userWithoutPassword } = user;

      res.json({
        token: accessToken,
        user: userWithoutPassword,
      });
    } catch {
      // Token tidak valid atau expired
      clearAuthCookie(res);
      clearRefreshTokenCookie(res);
      res.status(401).json({ error: 'Refresh token tidak valid atau sudah expired' });
    }
  } catch (error) {
    console.error('Refresh Token Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Endpoint untuk memeriksa status autentikasi
export const getAuthStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ambil token dari cookie atau header
    const headerToken = req.header('Authorization')?.split(' ')[1];
    const cookieToken = getAuthToken(req);
    const token = cookieToken || headerToken;

    if (!token) {
      res.status(401).json({
        status: false,
        message: 'Tidak terautentikasi',
        authenticated: false,
      });
      return;
    }

    // Periksa jika token ada di blacklist
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      clearAuthCookie(res);
      clearRefreshTokenCookie(res);
      res.status(401).json({
        status: false,
        message: 'Token telah dicabut',
        authenticated: false,
      });
      return;
    }

    try {
      // Verifikasi token
      const decoded = verifyToken(token) as {
        id: number;
        email: string;
        role: string;
      };

      if (!decoded) {
        clearAuthCookie(res);
        clearRefreshTokenCookie(res);
        res.status(401).json({ error: 'Token tidak valid' });
        return;
      }

      // Ambil data user
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });

      if (!user) {
        res.status(401).json({ error: 'User tidak ditemukan' });
        return;
      }

      // Transformasi data untuk response
      const userWithoutPassword: any = { ...user };
      delete userWithoutPassword.password;

      // Jika admin cabang, ambil branches dengan query terpisah
      if (decoded.role === 'admin_cabang') {
        const branchAdmins = await prisma.branchAdmin.findMany({
          where: { userId: decoded.id },
          include: {
            branch: true
          }
        });

        // Tambahkan data branches ke user
        userWithoutPassword.branches = branchAdmins.map(admin => ({
          userId: user.id,
          branchId: admin.branchId,
          branch: admin.branch
        }));
      }

      res.json({
        user: userWithoutPassword,
        token, // Mengembalikan token untuk kompatibilitas dengan client lama
      });
    } catch (error) {
      // Token tidak valid
      console.error('Token verification error:', error);
      clearAuthCookie(res);
      clearRefreshTokenCookie(res);
      res.status(401).json({ error: 'Token tidak valid atau sudah expired' });
    }
  } catch (error) {
    console.error('Auth Status Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Controller untuk forgot password
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = forgotPasswordSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const { email } = result.data;

    // Cek apakah email ada di database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Tetap kirim respons sukses meskipun email tidak ditemukan
      // Ini untuk mencegah enumeration attack
      res.json({
        message: 'Jika email terdaftar, instruksi reset password akan dikirim',
      });
      return;
    }

    // Buat token reset password (berlaku 1 jam)
    const resetToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        purpose: 'password_reset',
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    try {
      // Coba kirim email
      const emailSent = await sendPasswordResetEmail(user.email, resetToken);
      
      if (!emailSent) {
        // Jika pengiriman email gagal, tetap berikan respons sukses
        // tapi log errornya dan berikan link reset langsung di development mode
        console.error('Failed to send password reset email');
        
        if (!config.isProduction) {
          // Di lingkungan development, kembalikan token untuk testing
          const resetUrl = `${config.frontendUrl}/auth/reset-password/${encodeURIComponent(resetToken)}`;
          res.json({
            message: 'Mode development: Link reset password',
            resetUrl,
            token: resetToken
          });
          return;
        }
      }
      
      res.json({
        message: 'Instruksi reset password telah dikirim ke email Anda',
      });
    } catch (error) {
      console.error('Email service error:', error);
      
      // Fallback untuk development
      if (!config.isProduction) {
        const resetUrl = `${config.frontendUrl}/auth/reset-password/${encodeURIComponent(resetToken)}`;
        res.json({
          message: 'Mode development: Email service error, gunakan link ini',
          resetUrl,
          token: resetToken
        });
        return;
      }
      
      res.json({
        message: 'Instruksi reset password telah dikirim ke email Anda',
      });
    }
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Controller untuk reset password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validasi data dengan Zod
    const result = resetPasswordSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validasi gagal',
        details: result.error.format(),
      });
      return;
    }

    const { token, password } = result.data;

    // Verifikasi token
    try {
      const decoded = verifyToken(token) as {
        id: number;
        email: string;
        purpose: string;
      };

      // Cek apakah token memang untuk tujuan reset password
      if (!decoded || decoded.purpose !== 'password_reset') {
        res.status(400).json({ error: 'Token reset password tidak valid' });
        return;
      }

      // Cek apakah user ada
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        res.status(404).json({ error: 'User tidak ditemukan' });
        return;
      }

      // Hash password baru
      const hashedPassword = await hashPassword(password);

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      // Tambahkan token ke blacklist untuk mencegah penggunaan kembali
      await blacklistToken(token);

      res.json({ message: 'Password berhasil diperbarui' });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(400).json({ error: 'Token reset password tidak valid atau kedaluwarsa' });
    }
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
