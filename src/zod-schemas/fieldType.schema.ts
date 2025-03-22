import { z } from 'zod';

// Skema validasi Zod untuk pembuatan tipe lapangan
export const createFieldTypeSchema = z.object({
  name: z
    .string({
      message: 'Nama tipe lapangan wajib diisi',
    })
    .min(1, {
      message: 'Nama tipe lapangan tidak boleh kosong',
    })
    .max(100, {
      message: 'Nama tipe lapangan maksimal 100 karakter',
    }),
});

// Skema untuk update tipe lapangan
export const updateFieldTypeSchema = createFieldTypeSchema;
