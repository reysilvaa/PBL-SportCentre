import { z } from 'zod';

// Enum Role sesuai dengan Prisma
const RoleEnum = z.enum(['super_admin', 'admin_cabang', 'owner_cabang', 'user']);

// Skema validasi Zod untuk registrasi
export const registerSchema = z.object({
  email: z.string({
    message: 'Email wajib diisi'
  }).email({
    message: 'Format email tidak valid'
  }),
  password: z.string({
    message: 'Password wajib diisi'
  }).min(6, {
    message: 'Password minimal 6 karakter'
  }),
  name: z.string({
    message: 'Nama wajib diisi'
  }).min(1, {
    message: 'Nama tidak boleh kosong'
  }),
  role: RoleEnum.optional().default('user')
});

// Skema validasi Zod untuk login
export const loginSchema = z.object({
  email: z.string({
    message: 'Email wajib diisi'
  }).email({
    message: 'Format email tidak valid'
  }),
  password: z.string({
    message: 'Password wajib diisi'
  }).min(1, {
    message: 'Password tidak boleh kosong'
  })
}); 