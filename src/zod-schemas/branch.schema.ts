import { z } from 'zod';
import { BranchStatus } from '../types';

// Define the BranchStatus enum to match our types
const BranchStatusEnum = z.nativeEnum(BranchStatus);

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
  status: BranchStatusEnum.default(BranchStatus.ACTIVE),
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
  status: BranchStatusEnum,
});

// Schema untuk response cabang (termasuk relasi)
export const branchResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  location: z.string(),
  ownerId: z.number(),
  status: BranchStatusEnum,
  createdAt: z.date(),
  owner: z
    .object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    })
    .optional(),
});

export type CreateBranchInput = z.infer<typeof branchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type BranchResponse = z.infer<typeof branchResponseSchema>;
