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
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,9}$/, {
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
