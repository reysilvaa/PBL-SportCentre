import { z } from 'zod';

// Skema validasi Zod untuk branch
export const branchSchema = z.object({
  name: z.string().min(1, { message: 'Nama cabang wajib diisi' }),
  location: z.string().min(1, { message: 'Lokasi wajib diisi' }),
  ownerId: z.number({ message: 'ID pemilik harus berupa angka' }),
  status: z.enum(['active', 'inactive']).optional().default('active')
});

// Skema untuk update branch (semua field opsional)
export const updateBranchSchema = branchSchema.partial(); 