import { z } from 'zod';

// Skema validasi Zod untuk pembuatan lapangan
export const createFieldSchema = z.object({
  branchId: z.union(
    [
      z.number(),
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val)),
    ],
    {
      message: 'ID cabang harus berupa angka',
    },
  ),
  typeId: z.union(
    [
      z.number(),
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => parseInt(val)),
    ],
    {
      message: 'ID tipe lapangan harus berupa angka',
    },
  ),
  name: z
    .string({
      message: 'Nama lapangan wajib diisi',
    })
    .min(1, {
      message: 'Nama lapangan tidak boleh kosong',
    })
    .max(100, {
      message: 'Nama lapangan maksimal 100 karakter',
    }),
  priceDay: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z
      .number({
        message: 'Harga siang harus berupa angka',
      })
      .min(0, {
        message: 'Harga siang tidak boleh negatif',
      }),
  ),
  priceNight: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z
      .number({
        message: 'Harga malam harus berupa angka',
      })
      .min(0, {
        message: 'Harga malam tidak boleh negatif',
      }),
  ),
  status: z.enum(['available', 'maintenance', 'booked']).optional().default('available'),
});

// Skema untuk update lapangan (semua field opsional kecuali yang tidak boleh diubah)
export const updateFieldSchema = createFieldSchema.omit({ branchId: true }).partial();
