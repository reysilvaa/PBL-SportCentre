import { z } from 'zod';
import { Role } from '../types';

// Enum Role sesuai dengan tipe
const RoleEnum = z.nativeEnum(Role);

// Skema validasi Zod untuk registrasi
export const registerSchema = z.object({
  email: z
    .string({
      message: 'Email wajib diisi',
    })
    .email({
      message: 'Format email tidak valid',
    }),
  password: z
    .string({
      message: 'Password wajib diisi',
    })
    .min(6, {
      message: 'Password minimal 6 karakter',
    }),
  name: z
    .string({
      message: 'Nama wajib diisi',
    })
    .min(1, {
      message: 'Nama tidak boleh kosong',
    }),
  phone: z
    .string({
      message: 'Nomor telepon wajib diisi',
    })
    .min(1, {
      message: 'Nomor telepon tidak boleh kosong',
    })
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,13}$/, {
      message: 'Format nomor telepon tidak valid',
    })
    .optional(),
  role: RoleEnum.optional().default(Role.USER),
});

// Skema validasi Zod untuk login
export const loginSchema = z.object({
  // Field ini bisa berisi email atau nomor telepon
  email: z
    .string({
      message: 'Email atau nomor telepon wajib diisi',
    })
    .min(1, {
      message: 'Email atau nomor telepon tidak boleh kosong',
    }),
  password: z
    .string({
      message: 'Password wajib diisi',
    })
    .min(1, {
      message: 'Password tidak boleh kosong',
    }),
});

// Skema validasi untuk forgot password
export const forgotPasswordSchema = z.object({
  email: z
    .string({
      message: 'Email wajib diisi',
    })
    .email({
      message: 'Format email tidak valid',
    }),
});

// Skema validasi untuk reset password
export const resetPasswordSchema = z.object({
  token: z
    .string({
      message: 'Token reset password wajib diisi',
    })
    .min(1, {
      message: 'Token reset password tidak boleh kosong',
    }),
  password: z
    .string({
      message: 'Password baru wajib diisi',
    })
    .min(6, {
      message: 'Password baru minimal 6 karakter',
    }),
  confirmPassword: z
    .string({
      message: 'Konfirmasi password wajib diisi',
    })
    .min(1, {
      message: 'Konfirmasi password tidak boleh kosong',
    }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok dengan password baru',
  path: ['confirmPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
