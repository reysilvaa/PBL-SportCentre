import { z } from 'zod';
import { FieldStatus } from '../types';

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
    }
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
    }
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
      })
  ),
  priceNight: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z
      .number({
        message: 'Harga malam harus berupa angka',
      })
      .min(0, {
        message: 'Harga malam tidak boleh negatif',
      })
  ),
  status: z.nativeEnum(FieldStatus).optional().default(FieldStatus.AVAILABLE),
  // ✅ TAMBAHAN: Field imageUrl untuk create
  imageUrl: z.string().optional(),
});

// ✅ PERBAIKAN: Skema untuk update lapangan dengan field imageUrl yang bisa null
export const updateFieldSchema = z.object({
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
    }
  ).optional(),
  name: z
    .string({
      message: 'Nama lapangan wajib diisi',
    })
    .min(1, {
      message: 'Nama lapangan tidak boleh kosong',
    })
    .max(100, {
      message: 'Nama lapangan maksimal 100 karakter',
    })
    .optional(),
  priceDay: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z
      .number({
        message: 'Harga siang harus berupa angka',
      })
      .min(0, {
        message: 'Harga siang tidak boleh negatif',
      })
  ).optional(),
  priceNight: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val) : val),
    z
      .number({
        message: 'Harga malam harus berupa angka',
      })
      .min(0, {
        message: 'Harga malam tidak boleh negatif',
      })
  ).optional(),
  status: z.nativeEnum(FieldStatus).optional(),
  // ✅ KUNCI: Izinkan imageUrl null untuk penghapusan gambar
  imageUrl: z.string().nullable().optional(),
  // ✅ TAMBAHAN: Field untuk super admin yang bisa mengubah branchId
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
    }
  ).optional(),
});

export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;