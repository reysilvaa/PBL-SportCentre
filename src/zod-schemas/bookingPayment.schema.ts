import { z } from 'zod';

// Skema validasi Zod untuk update pembayaran booking
export const updateBookingPaymentSchema = z.object({
  paymentStatus: z
    .enum(['pending', 'paid', 'dp_paid', 'failed', 'refunded'], {
      message:
        'Status pembayaran harus salah satu dari: pending, paid, dp_paid, failed, refunded',
    })
    .optional(),

  paymentMethod: z
    .enum(['midtrans', 'cash', 'transfer', 'credit_card', 'ewallet'], {
      message:
        'Metode pembayaran harus salah satu dari: midtrans, cash, transfer, credit_card, ewallet',
    })
    .optional(),

  amount: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z
      .number({
        message: 'Jumlah pembayaran harus berupa angka',
      })
      .min(0, {
        message: 'Jumlah pembayaran tidak boleh negatif',
      })
      .optional(),
  ),
});
