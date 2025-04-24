import { z } from 'zod';

// Skema validasi Zod untuk pembuatan review lapangan
export const createFieldReviewSchema = z.object({
  userId: z.union(
    [
      z.number(),
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val)),
    ],
    {
      message: 'ID pengguna harus berupa angka',
    }
  ),
  fieldId: z.union(
    [
      z.number(),
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val)),
    ],
    {
      message: 'ID lapangan harus berupa angka',
    }
  ),
  rating: z
    .number({
      message: 'Rating harus berupa angka',
    })
    .min(1, {
      message: 'Rating minimal 1',
    })
    .max(5, {
      message: 'Rating maksimal 5',
    }),
  review: z
    .string({
      message: 'Review wajib diisi',
    })
    .min(1, {
      message: 'Review tidak boleh kosong',
    })
    .max(500, {
      message: 'Review maksimal 500 karakter',
    }),
});

// Skema untuk update review lapangan (hanya rating dan review yang bisa diubah)
export const updateFieldReviewSchema = z.object({
  rating: z
    .number({
      message: 'Rating harus berupa angka',
    })
    .min(1, {
      message: 'Rating minimal 1',
    })
    .max(5, {
      message: 'Rating maksimal 5',
    })
    .optional(),
  review: z
    .string({
      message: 'Review wajib diisi',
    })
    .min(1, {
      message: 'Review tidak boleh kosong',
    })
    .max(500, {
      message: 'Review maksimal 500 karakter',
    })
    .optional(),
});
