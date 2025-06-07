import { Request, Response } from 'express';
import prisma from '../../config/services/database';
import { PaymentStatus, PaymentMethod } from '../../types/enums';
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
 * Map tipe pembayaran dari Midtrans ke PaymentMethod enum
 */
const mapMidtransPaymentTypeToEnum = (
  paymentType: string, 
  paymentCode?: string
): PaymentMethod | undefined => {
  if (!paymentType) return undefined;
  
  switch(paymentType) {
    case 'credit_card':
      return PaymentMethod.CREDIT_CARD;
      
    case 'bank_transfer':
      // Cek bank dari payment code
      if (paymentCode) {
        if (paymentCode.includes('bca')) return PaymentMethod.BCA_VA;
        if (paymentCode.includes('bni')) return PaymentMethod.BNI_VA;
        if (paymentCode.includes('bri')) return PaymentMethod.BRI_VA;
        if (paymentCode.includes('mandiri')) return PaymentMethod.MANDIRI_VA;
        if (paymentCode.includes('permata')) return PaymentMethod.PERMATA_VA;
        if (paymentCode.includes('cimb') || paymentCode.includes('niaga')) return PaymentMethod.CIMB_VA;
        if (paymentCode.includes('danamon')) return PaymentMethod.DANAMON_VA;
      }
      return PaymentMethod.BCA_VA; // Default to BCA_VA jika tidak ada detail spesifik
      
    case 'echannel':
      return PaymentMethod.MANDIRI_VA; // Mandiri Bill Payment
      
    case 'gopay':
    case 'gopay-tokenization':
      return PaymentMethod.GOPAY;
      
    case 'shopeepay':
      return PaymentMethod.SHOPEEPAY;
      
    case 'qris':
      return PaymentMethod.QRIS;
      
    case 'cstore':
      if (!paymentCode) return undefined;
      if (paymentCode.toLowerCase().includes('indomaret')) return PaymentMethod.INDOMARET;
      if (paymentCode.toLowerCase().includes('alfa')) return PaymentMethod.ALFAMART;
      return undefined;
      
    case 'akulaku':
      return PaymentMethod.AKULAKU;
      
    case 'kredivo':
      return PaymentMethod.KREDIVO;
      
    case 'dana':
      return PaymentMethod.DANA;

    case 'paypal':
      return PaymentMethod.PAYPAL;

    case 'google_pay':
      return PaymentMethod.GOOGLE_PAY;

    // Cash payment adalah jika dilakukan di tempat (bukan melalui Midtrans)
    case 'cash':
      return PaymentMethod.CASH;
      
    default:
      // Jika tipe pembayaran tidak diketahui, kembalikan undefined
      // dan biarkan status tetap saat ini
      console.log(`[WEBHOOK] Unknown payment type: ${paymentType} with code: ${paymentCode}`);
      return undefined;
  }
};

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
      case 'dp_paid':
        title = 'Uang Muka Berhasil Dibayar';
        message = `Pembayaran uang muka untuk booking #${bookingId} lapangan ${fieldName} telah berhasil. Sisa pembayaran dapat dilakukan di tempat.`;
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

    if (notification.signature_key) {
      const orderId = notification.order_id;
      const statusCode = notification.status_code;
      const grossAmount = notification.gross_amount;
      const serverKey = config.midtransServerKey || ''; // Menggunakan midtransServerKey dari config

      console.log('[WEBHOOK] Verifying signature with:', {
        orderId,
        statusCode,
        grossAmount,
        serverKeyPrefix: serverKey.substring(0, 10) + '...'
      });

      const hash = createHmac('sha512', serverKey)
        .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
        .digest('hex');

      console.log('[WEBHOOK] Calculated hash:', hash.substring(0, 10) + '...');
      console.log('[WEBHOOK] Received signature:', notification.signature_key.substring(0, 10) + '...');

      if (hash !== notification.signature_key) {
        console.error('[WEBHOOK] Invalid signature key detected!');
        console.error('[WEBHOOK] Expected:', hash);
        console.error('[WEBHOOK] Received:', notification.signature_key);
        
        // Di lingkungan production dengan sandbox, kita tetap proses meskipun signature tidak cocok
        if (config.forceMidtransSandbox) {
          console.log('[WEBHOOK] Continuing despite signature mismatch due to FORCE_MIDTRANS_SANDBOX=true');
        } else {
          throw new BadRequestError('Invalid signature key');
        }
      }
    }

    // Extract order ID - support multiple formats
    // Format 1: PAY-{id}
    // Format 2: PAY-{id}-{timestamp}
    let paymentId: number | null = null;
    const orderIdMatch = notification.order_id.match(/PAY-(\d+)(?:-\d+)?/);
    
    if (orderIdMatch) {
      paymentId = parseInt(orderIdMatch[1]);
      console.log(`[WEBHOOK] Extracted payment ID: ${paymentId} from order ID: ${notification.order_id}`);
    } else {
      console.error('[WEBHOOK] Invalid order ID format:', notification.order_id);
      throw new BadRequestError('Invalid order ID format');
    }

    console.log(`[WEBHOOK] Processing payment ID: ${paymentId}`);

    // Find payment record in the database
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            user: { 
              select: { id: true, email: true, name: true, role: true } 
            },
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
    const expiryTime = notification.expiry_time || null;

    switch (notification.transaction_status) {
      case 'capture':
      case 'settlement':
        // User role biasa mendapatkan status dp_paid, role lain mendapatkan status paid
        if (payment.booking.user.role === 'user') {
          paymentStatus = PaymentStatus.DP_PAID;
          console.log(`[WEBHOOK] Transaction settled/captured for payment #${paymentId} as down payment (dp_paid)`);
        } else {
          paymentStatus = PaymentStatus.PAID;
          console.log(`[WEBHOOK] Transaction settled/captured for payment #${paymentId} as fully paid`);
        }
        break;
      case PaymentStatus.PENDING:
        paymentStatus = PaymentStatus.PENDING;
        console.log(`[WEBHOOK] Transaction pending for payment #${paymentId}`);
        break;
      case 'deny':
      case 'expire':
      case 'cancel':
        paymentStatus = PaymentStatus.FAILED;
        console.log(`[WEBHOOK] Transaction failed (${notification.transaction_status}) for payment #${paymentId}`);
        break;
      default:
        paymentStatus = PaymentStatus.PENDING;
        console.log(`[WEBHOOK] Unknown transaction status: ${notification.transaction_status}, defaulting to pending`);
    }

    // Coba konversi payment method dari Midtrans
    const paymentMethodValue = mapMidtransPaymentTypeToEnum(notification.payment_type, notification.payment_code);
    
    // Siapkan data untuk update payment
    const updateData: any = {
      status: paymentStatus,
      transactionId,
      paymentUrl,
      expiresDate: expiryTime ? new Date(expiryTime) : undefined,
    };
    
    // Tambahkan payment method hanya jika berhasil dikonversi
    if (paymentMethodValue) {
      updateData.paymentMethod = paymentMethodValue;
    }

    // Update payment record in database with transaction info dan expiry time
    const _updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
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

    // For paid or dp_paid status, add success activity log
    if (paymentStatus === PaymentStatus.PAID || paymentStatus === PaymentStatus.DP_PAID) {
      const paymentType = paymentStatus === PaymentStatus.DP_PAID ? 'uang muka' : 'lunas';
      
      await prisma.activityLog.create({
        data: {
          userId: payment.booking.userId,
          action: 'PAYMENT_SUCCESS',
          details: `Pembayaran ${paymentType} booking #${payment.bookingId} untuk lapangan ${payment.booking.field.name} berhasil`,
          ipAddress: req.ip || undefined,
        },
      });

      // Reset failed booking counter for this user
      resetFailedBookingCounter(payment.booking.userId);
    } else if (paymentStatus === PaymentStatus.FAILED) {
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
