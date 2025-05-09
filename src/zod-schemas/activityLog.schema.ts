import { z } from 'zod';

// Skema validasi Zod untuk pembuatan log aktivitas
export const createActivityLogSchema = z.object({
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
    },
  ),
  action: z
    .string({
      message: 'Aksi wajib diisi',
    })
    .min(1, {
      message: 'Aksi tidak boleh kosong',
    }),
  details: z
    .string({
      message: 'Detail wajib diisi',
    })
    .min(1, {
      message: 'Detail tidak boleh kosong',
    }),
  relatedId: z
    .union(
      [
        z.number(),
        z
          .string()
          .regex(/^\d+$/)
          .transform((val) => parseInt(val)),
        z.null(),
      ],
      {
        message: 'ID terkait harus berupa angka atau null',
      },
    )
    .optional()
    .nullable(),
  ipAddress: z.string().optional(),
});

export type CreateActivityLogInput = z.infer<typeof createActivityLogSchema>;
