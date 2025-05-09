import { Request, Response } from 'express';
import prisma from '../../config/services/database';
import { PaymentStatus } from '@prisma/client';
import { emitBookingEvents } from '../../utils/booking/booking.utils';
import { getIO } from '../../config/server/socket';
import { trackFailedBooking, resetFailedBookingCounter } from '../../middlewares/security.middleware';
import { createHmac } from 'crypto';
import { config } from '../../config/app/env';
import { invalidatePaymentCache } from '../../utils/cache/cacheInvalidation.utils';

// Definisi kelas error untuk bad request
class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

// Import the global type definition
declare global {
  var activeLocks: Record<string, boolean>;
}

/**
 * Membuat notifikasi untuk user terkait perubahan status pembayaran
 */
const createPaymentNotification = async (
  userId: number,
  bookingId: number,
  fieldName: string,
  status: PaymentStatus
) => {
  try {
    let title = '';
    let message = '';
    const type = 'payment';

    switch (status) {
      case 'paid':
        title = 'Pembayaran Berhasil';
        message = `Pembayaran untuk booking #${bookingId} lapangan ${fieldName} telah berhasil. Terima kasih!`;
        break;
      case 'pending':
        title = 'Menunggu Pembayaran';
        message = `Pembayaran untuk booking #${bookingId} lapangan ${fieldName} sedang menunggu konfirmasi.`;
        break;
      case 'failed':
        title = 'Pembayaran Gagal';
        message = `Pembayaran untuk booking #${bookingId} lapangan ${fieldName} gagal. Silakan coba lagi.`;
        break;
      default:
        title = 'Update Status Pembayaran';
        message = `Status pembayaran untuk booking #${bookingId} lapangan ${fieldName} telah diperbarui menjadi ${status}.`;
    }

    // Buat notifikasi di database
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        linkId: bookingId.toString(),
        isRead: false,
      },
    });

    // Kirim notifikasi lewat socket
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification', {
        id: notification.id,
        title,
        message,
        type,
        linkId: bookingId.toString(),
        createdAt: notification.createdAt,
      });

      console.log(`[NOTIFICATION] Notifikasi pembayaran terkirim ke user #${userId}`);
    }

    return notification;
  } catch (error) {
    console.error('[NOTIFICATION ERROR] Gagal membuat notifikasi pembayaran:', error);
    return null;
  }
};

export const handleMidtransNotification = async (req: Request, res: Response): Promise<void> => {
  console.log('[WEBHOOK] Mulai memproses notifikasi Midtrans', new Date().toISOString());

  try {
    const notification = req.body;
    console.log('[WEBHOOK] Received Midtrans notification:', JSON.stringify(notification));

    // Verify notification signature if one is provided
    if (notification.signature_key) {
      const orderId = notification.order_id;
      const statusCode = notification.status_code;
      const grossAmount = notification.gross_amount;
      const serverKey = config.midtransServerKey || ''; // Menggunakan midtransServerKey dari config

      const hash = createHmac('sha512', serverKey)
        .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
        .digest('hex');

      if (hash !== notification.signature_key) {
        console.error('[WEBHOOK] Invalid signature key detected!');
        throw new BadRequestError('Invalid signature key');
      }
    }

    // Extract order ID (expected format: PAY-{id})
    const orderIdMatch = notification.order_id.match(/PAY-(\d+)/);
    if (!orderIdMatch) {
      console.error('[WEBHOOK] Invalid order ID format:', notification.order_id);
      throw new BadRequestError('Invalid order ID format');
    }

    const paymentId = parseInt(orderIdMatch[1]);
    console.log(`[WEBHOOK] Processing payment ID: ${paymentId}`);

    // Find payment record in the database
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            user: { select: { id: true, email: true, name: true } },
            field: {
              select: {
                id: true,
                name: true,
                branchId: true,
                branch: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      console.error(`[WEBHOOK] Payment with ID ${paymentId} not found`);
      throw new BadRequestError(`Payment with ID ${paymentId} not found`);
    }

    console.log(
      `[WEBHOOK] Booking #${payment.bookingId} - User: ${payment.booking.user.name} (${payment.booking.user.id}) - Field: ${payment.booking.field.name}`
    );

    // Map Midtrans transaction status to our payment status
    let paymentStatus: PaymentStatus;
    const transactionId = notification.transaction_id || null;
    const paymentUrl = notification.redirect_url || null;

    switch (notification.transaction_status) {
      case 'capture':
      case 'settlement':
        paymentStatus = 'paid';
        console.log(`[WEBHOOK] Transaction settled/captured for payment #${paymentId}`);
        break;
      case 'pending':
        paymentStatus = 'pending';
        console.log(`[WEBHOOK] Transaction pending for payment #${paymentId}`);
        break;
      case 'deny':
      case 'expire':
      case 'cancel':
        paymentStatus = 'failed';
        console.log(`[WEBHOOK] Transaction failed (${notification.transaction_status}) for payment #${paymentId}`);
        break;
      default:
        paymentStatus = 'pending';
        console.log(`[WEBHOOK] Unknown transaction status: ${notification.transaction_status}, defaulting to pending`);
    }

    // Update payment record in database
    const _updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: paymentStatus,
        transactionId,
        paymentUrl,
      },
    });

    console.log(`[WEBHOOK] Updated payment #${paymentId} status to: ${paymentStatus}`);

    // Invalidate related caches to ensure fresh data
    const cacheInvalidated = await invalidatePaymentCache(
      paymentId,
      payment.bookingId,
      payment.booking.fieldId,
      payment.booking.field.branchId,
      payment.booking.userId
    );

    if (!cacheInvalidated) {
      console.warn(`[WEBHOOK] Cache invalidation problems detected for payment #${paymentId}`);
    }

    // Emit WebSocket notification
    emitBookingEvents('payment-update', {
      bookingId: payment.bookingId,
      userId: payment.booking.userId,
      fieldId: payment.booking.fieldId,
      branchId: payment.booking.field.branchId,
      paymentId: payment.id,
      status: paymentStatus,
      updateTime: new Date().toISOString(),
    });

    // Buat notifikasi untuk user
    await createPaymentNotification(
      payment.booking.userId,
      payment.bookingId,
      payment.booking.field.name,
      paymentStatus
    );

    // For paid status, add success activity log
    if (paymentStatus === 'paid') {
      await prisma.activityLog.create({
        data: {
          userId: payment.booking.userId,
          action: 'PAYMENT_SUCCESS',
          details: `Pembayaran booking #${payment.bookingId} untuk lapangan ${payment.booking.field.name} berhasil`,
          ipAddress: req.ip || undefined,
        },
      });

      // Reset failed booking counter for this user
      resetFailedBookingCounter(payment.booking.userId);
    } else if (paymentStatus === 'failed') {
      // Track failed payment untuk keamanan
      trackFailedBooking(payment.booking.userId, payment.bookingId, req.ip || '0.0.0.0');

      // Log kegagalan pembayaran
      await prisma.activityLog.create({
        data: {
          userId: payment.booking.userId,
          action: 'PAYMENT_FAILED',
          details: `Pembayaran booking #${payment.bookingId} untuk lapangan ${payment.booking.field.name} gagal (${notification.transaction_status})`,
          ipAddress: req.ip || undefined,
        },
      });
    }

    console.log(`[WEBHOOK] Midtrans notification processing completed for payment #${paymentId}`);

    res.status(200).json({
      status: 'success',
      message: 'Notification processed',
      data: {
        orderId: notification.order_id,
        status: paymentStatus,
        transactionId,
        bookingId: payment.bookingId,
      },
    });
  } catch (error) {
    console.error('[WEBHOOK ERROR] Error handling Midtrans notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    res.status(error instanceof BadRequestError ? 400 : 500).json({
      status: 'error',
      message: errorMessage,
    });
  }
};
