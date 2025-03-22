import { z } from 'zod';

// Define the BranchStatus enum to match Prisma's enum
const BranchStatus = z.enum(['active', 'inactive']);

// Schema untuk pembuatan cabang baru
export const branchSchema = z.object({
  name: z
    .string({
      required_error: 'Nama cabang wajib diisi',
    })
    .min(1, {
      message: 'Nama cabang tidak boleh kosong',
    })
    .max(100, {
      message: 'Nama cabang maksimal 100 karakter',
    }),
  location: z
    .string({
      required_error: 'Lokasi cabang wajib diisi',
    })
    .min(1, {
      message: 'Lokasi tidak boleh kosong',
    }),
  ownerId: z
    .number({
      required_error: 'ID pemilik wajib diisi',
    })
    .int({
      message: 'ID pemilik harus berupa bilangan bulat',
    })
    .positive({
      message: 'ID pemilik harus berupa angka positif',
    }),
  status: BranchStatus.default('active'),
});

// Schema untuk mengupdate cabang
export const updateBranchSchema = z.object({
  name: z
    .string({
      required_error: 'Nama cabang wajib diisi',
    })
    .min(1, {
      message: 'Nama cabang tidak boleh kosong',
    })
    .max(100, {
      message: 'Nama cabang maksimal 100 karakter',
    }),
  location: z
    .string({
      required_error: 'Lokasi cabang wajib diisi',
    })
    .min(1, {
      message: 'Lokasi tidak boleh kosong',
    }),
  imageUrl: z.string().nullable().optional(),
  status: BranchStatus,
});

// Schema untuk response cabang (termasuk relasi)
export const branchResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  location: z.string(),
  ownerId: z.number(),
  status: BranchStatus,
  createdAt: z.date(),
  owner: z
    .object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    })
    .optional(),
});
