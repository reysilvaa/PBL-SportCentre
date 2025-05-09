import { z } from 'zod';

// Skema validasi Zod untuk pembuatan booking
export const createBookingSchema = z.object({
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
    },
  ),
  bookingDate: z
    .string({
      message: 'Tanggal booking wajib diisi',
    })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Format tanggal booking tidak valid',
    }),
  startTime: z
    .string({
      message: 'Waktu mulai wajib diisi',
    })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
      message: 'Format waktu mulai tidak valid (HH:MM)',
    }),
  endTime: z
    .string({
      message: 'Waktu selesai wajib diisi',
    })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
      message: 'Format waktu selesai tidak valid (HH:MM)',
    }),
});

// Skema untuk update booking (semua field opsional)
export const updateBookingSchema = createBookingSchema.partial();

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
