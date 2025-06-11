import { z } from 'zod';
import { PaymentMethod, PaymentStatus, BookingStatus } from '../types/enums';

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
  paymentMethod: z
    .enum([
      PaymentMethod.GOPAY,
      PaymentMethod.SHOPEEPAY,
      PaymentMethod.QRIS,
      PaymentMethod.BCA_VA,
      PaymentMethod.BRI_VA,
      PaymentMethod.BNI_VA,
      PaymentMethod.PERMATA_VA,
      PaymentMethod.MANDIRI_BILL,
      PaymentMethod.CIMB_VA,
      PaymentMethod.DANAMON_VA,
      PaymentMethod.INDOMARET,
      PaymentMethod.ALFAMART,
      PaymentMethod.AKULAKU,
      PaymentMethod.KREDIVO,
      PaymentMethod.DANA,
      PaymentMethod.CREDIT_CARD,
      PaymentMethod.CASH
    ] as const)
    .optional()
    .describe('Metode pembayaran: kartu kredit, virtual account bank, e-wallet, dll. Bisa null/undefined karena akan ditentukan oleh webhook Midtrans'),
  paymentStatus: z
    .enum([
      PaymentStatus.PAID,
      PaymentStatus.DP_PAID,
      PaymentStatus.PENDING,
      PaymentStatus.FAILED,
      PaymentStatus.REFUNDED
    ] as const)
    .optional()
    .describe('Status pembayaran: dibayar penuh, DP dibayar, menunggu pembayaran, dll. Untuk admin booking.')
});

// Skema untuk update booking (semua field opsional)
export const updateBookingSchema = createBookingSchema.partial();

// Skema untuk update status booking
export const updateBookingStatusSchema = z.object({
  status: z.enum([
    BookingStatus.ACTIVE,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED
  ] as const, {
    message: 'Status harus salah satu dari: active, completed, cancelled'
  }).describe('Status booking: aktif, selesai, atau dibatalkan')
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
