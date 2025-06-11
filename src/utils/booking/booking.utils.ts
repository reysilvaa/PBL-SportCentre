import { Response } from 'express';
import prisma from '../../config/services/database';
import { PaymentStatus, PaymentMethod, User, Booking, Payment, Field, Role, BookingStatus } from '../../types';
import { isFieldAvailable } from './checkAvailability.utils';
import { midtrans } from '../../config/services/midtrans';
import { emitBookingEvents } from '../../socket-handlers/booking.socket';
import { config } from '../../config/app/env';

/**
 * Standardized error response
 */
export const sendErrorResponse = (
  res: Response,
  status: number,
  message: any,
  details?: any
): void => {
  res.status(status).json({ error: message, ...(details && { details }) });
};

/**
 * Verify field belongs to branch
 */
export const verifyFieldBranch = async (
  fieldId: number,
  branchId: number
): Promise<Field | null> => {
  const field = await prisma.field.findFirst({
    where: {
      id: fieldId,
      branchId: branchId,
    },
  });

  return field as Field | null;
};

/**
 * Check booking time validity and availability
 * Fungsi menggunakan waktu dalam timezone UTC untuk pengecekan
 */
export const validateBookingTime = async (
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date
): Promise<{ valid: boolean; message?: string; details?: any }> => {
  // Validate start and end times
  if (startTime >= endTime) {
    return {
      valid: false,
      message: 'Waktu selesai harus setelah waktu mulai',
      details: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    };
  }

  // Log untuk debugging
  console.log('Validating booking time:');
  console.log(`Field ID: ${fieldId}`);
  console.log(`Start Time: ${startTime.toISOString()}`);
  console.log(`End Time: ${endTime.toISOString()}`);

  // Check field availability
  const isAvailable = await isFieldAvailable(fieldId, bookingDate, startTime, endTime);

  if (!isAvailable) {
    return {
      valid: false,
      message: 'Lapangan sudah dibooking untuk waktu yang dipilih',
      details: {
        fieldId,
        date: bookingDate.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    };
  }

  return { valid: true };
};

/**
 * Create booking and payment records
 * PENTING: Semua parameter waktu harus dalam format UTC untuk konsistensi di database
 */
export const createBookingWithPayment = async (
  userId: number,
  fieldId: number,
  bookingDate: Date,
  startTime: Date,
  endTime: Date,
  paymentStatus: PaymentStatus = PaymentStatus.PENDING,
  paymentMethod?: PaymentMethod,
  amount?: any
): Promise<{ booking: Booking; payment: Payment }> => {
  // Log nilai waktu untuk debugging
  console.log('Creating booking:');
  console.log(`Booking Date: ${bookingDate.toISOString()}`);
  console.log(`Start Time: ${startTime.toISOString()}`);
  console.log(`End Time: ${endTime.toISOString()}`);

  // Pastikan bookingDate adalah objek Date yang valid
  const bookingDateObj = new Date(bookingDate);
  if (isNaN(bookingDateObj.getTime())) {
    throw new Error('Invalid bookingDate format. Must be a valid Date object or ISO-8601 string.');
  }

  // Create booking record
  const booking = await prisma.booking.create({
    data: {
      userId,
      fieldId,
      bookingDate: bookingDateObj,
      startTime,
      endTime,
    },
  });

  // Get field for pricing if amount not provided
  let paymentAmount = amount;
  if (!paymentAmount) {
    const field = await prisma.field.findUnique({ where: { id: fieldId } });
    if (field) {
      paymentAmount = field.priceDay; // Default to day price
    } else {
      paymentAmount = 0; // Fallback
    }
  }

  // Create payment record, tanpa paymentMethod saat awal
  const paymentData: any = {
    bookingId: booking.id,
    userId,
    amount: paymentAmount,
    status: paymentStatus,
  };

  // Tambahkan payment method hanya jika disediakan (untuk pembayaran tunai)
  if (paymentMethod) {
    paymentData.paymentMethod = paymentMethod;
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: paymentData,
  });

  return { booking: booking as Booking, payment: payment as Payment };
};

/**
 * Process Midtrans payment for booking
 * @param paymentMethod - Preferensi metode pembayaran dari pengguna, akan digunakan untuk konfigurasi Midtrans
 * Metode pembayaran sebenarnya akan ditentukan oleh webhook Midtrans setelah pengguna menyelesaikan pembayaran
 * @param isCompletion - Menandakan apakah ini adalah pembayaran pelunasan (true) atau pembayaran awal (false)
 */
export const processMidtransPayment = async (
  booking: Booking,
  payment: Payment,
  field: Field,
  user: User,
  totalPrice: number,
  paymentMethod: PaymentMethod = PaymentMethod.CREDIT_CARD,
  isCompletion: boolean = false
): Promise<{ transaction: any; expiryDate: Date }> => {
  const expiryMinutes = 4; //   

  // Pastikan paymentMethod selalu memiliki nilai valid
  const safePaymentMethod = paymentMethod || PaymentMethod.CREDIT_CARD;
  
  console.log(`💳 Processing Midtrans payment for booking #${booking.id} with method: ${safePaymentMethod}`);

  // Tentukan apakah transaksi ini adalah DP atau pembayaran penuh
  // Jika isCompletion=true, gunakan totalPrice langsung (tidak perlu hitung DP lagi)
  const isDownPayment = !isCompletion && user.role === Role.USER;
  const paymentAmount = isDownPayment ? Math.ceil(totalPrice * 0.5) : totalPrice; // DP 50% untuk user biasa
  const paymentLabel = isDownPayment ? 'DP Booking' : (isCompletion ? 'Pelunasan' : 'Pembayaran');

  // Config untuk transaksi Midtrans
  const transactionConfig: any = {
    transaction_details: {
      order_id: `PAY-${payment.id}-${Date.now()}`,
      gross_amount: paymentAmount,
    },
    customer_details: {
      first_name: user.name || 'Customer',
      email: user.email || 'customer@example.com',
      phone: user.phone || '08123456789',
    },
    item_details: [
      {
        id: field.id.toString(),
        name: `${paymentLabel} ${field.name}`, 
        price: paymentAmount,
        quantity: 1,
      },
    ],
    expiry: {
      unit: 'minutes',
      duration: expiryMinutes,
    }
  };

  // Konfigurasi tambahan berdasarkan metode pembayaran
  switch (safePaymentMethod) {
    case 'credit_card':
      // Tambahan untuk Credit Card
      transactionConfig.credit_card = {
        secure: true,
      };
      break;
      
    case 'gopay':
      // Konfigurasi khusus GoPay
      transactionConfig.gopay = {
        enable_callback: true,
      };
      break;
      
    case 'shopeepay':
      // Konfigurasi khusus ShopeePay
      transactionConfig.shopeepay = {
        callback_url: `${config.frontendUrl}/bookings`
      };
      break;
      
    case 'bca_va':
    case 'bni_va':
    case 'bri_va':
    case 'mandiri_va':
    case 'permata_va':
    case 'cimb_va':
    case 'danamon_va':
      // Ekstrak nama bank dari metode pembayaran (mis. bca dari bca_va)
      { const bankName = safePaymentMethod.split('_')[0];
      // Konfigurasi VA sesuai bank
      transactionConfig.bank_transfer = {
        bank: bankName
      };
      break; }
      
    case 'indomaret':
    case 'alfamart':
      // Konfigurasi untuk pembayaran di retail store
      transactionConfig.cstore = {
        store: safePaymentMethod,
        message: `Pembayaran untuk ${field.name}`,
      };
      break;
      
    case 'kredivo':
    case 'akulaku':
      // Konfigurasi untuk paylater
      transactionConfig.enabled_payments = [safePaymentMethod];
      break;
      
    case 'qris':
      // Konfigurasi untuk QRIS
      transactionConfig.qris = {
        acquirer: "gopay"
      };
      break;
      
    case 'dana':
      // Konfigurasi untuk DANA
      transactionConfig.enabled_payments = ["dana"];
      break;
      
    case 'paypal':
      // Konfigurasi untuk PayPal
      transactionConfig.enabled_payments = ["paypal"];
      break;
      
    case 'google_pay':
      // Konfigurasi untuk Google Pay
      transactionConfig.enabled_payments = ["google_pay"];
      break;
  }

  // Create Midtrans transaction with expiry
  const midtransClient = midtrans();
  const transaction = await midtransClient.createTransaction(transactionConfig);

  let expiryDate: Date;

  if (transaction.expiry_time) {
    expiryDate = new Date(transaction.expiry_time);
  } else {
    expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes);
  }

  // Update the payment record with the expiry date, payment URL, and transaction ID
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      expiresDate: expiryDate,
      paymentUrl: transaction.redirect_url,
      transactionId: transaction.transaction_id,
      // Store the actual amount to be paid (may be DP amount)
      amount: paymentAmount,
      // Tidak set payment method di sini, akan diupdate dari webhook
    },
  });

  return { transaction, expiryDate };
};

/**
 * Function to mark expired pending bookings as failed
 * Bookings that haven't been paid within 5 minutes after Midtrans confirmation will be marked as failed
 * Also handles payments that don't have expiresDate set (no webhook received)
 */
export const cleanupPendingBookings = async (): Promise<void> => {
  try {
    // Find payments with 'pending' status that have passed their expiration date
    const currentTime = new Date();

    console.log('🧹 Processing expired pending bookings at:', currentTime);

    // Cari pembayaran yang sudah expired berdasarkan expiresDate
    const expiredWithDatePayments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        expiresDate: {
          not: null, // Only process payments that have an expiry date set
          lt: currentTime, // Only process expired payments
        },
      },
      include: {
        booking: {
          include: {
            field: true,
            user: true,
          },
        },
      },
    });

    // Cari pembayaran yang tidak memiliki expiresDate tapi sudah dibuat lebih dari 30 menit yang lalu
    const thirtyMinutesAgo = new Date(currentTime.getTime() - 30 * 60 * 1000);
    const expiredWithoutDatePayments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        expiresDate: null, // Pembayaran tanpa expiresDate
        createdAt: {
          lt: thirtyMinutesAgo, // Dibuat lebih dari 30 menit yang lalu
        },
      },
      include: {
        booking: {
          include: {
            field: true,
            user: true,
          },
        },
      },
    });

    // Gabungkan kedua array pembayaran yang expired
    const expiredPayments = [...expiredWithDatePayments, ...expiredWithoutDatePayments];

    console.log(`🔍 Found ${expiredPayments.length} expired pending payments (${expiredWithDatePayments.length} with date, ${expiredWithoutDatePayments.length} without date)`);

    // Update the payment status to 'failed' instead of deleting
    for (const payment of expiredPayments) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      console.log(
        `🔄 Updated payment #${payment.id} status to 'failed' for booking #${payment.booking?.id}`
      );

      // Emit event for booking cancellation to update field availability
      if (payment.booking) {
        const booking = payment.booking;

        // Emit event to notify system that booking is canceled
        emitBookingEvents('cancel-booking', {
          bookingId: booking.id,
          fieldId: booking.fieldId,
          userId: booking.userId,
          branchId: booking.field?.branchId,
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
        });

        // Emit notification to user
        emitBookingEvents('booking:updated', {
          booking: booking,
          userId: booking.userId,
          branchId: booking.field?.branchId,
          paymentStatus: 'failed',
        });

        console.log(
          `🔔 Notified system about canceled booking #${booking.id} due to payment expiry`
        );
      }
    }

    console.log('✅ Expired booking processing completed');
  } catch (error) {
    console.error('❌ Error in cleanupPendingBookings:', error);
  }
};

/**
 * Get complete booking with relations
 * Updated to support multiple payments
 */
export const getCompleteBooking = async (bookingId: number): Promise<Booking | null> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      field: { include: { branch: true } },
      payments: true, // Tetap gunakan payment untuk kompatibilitas dengan tipe saat ini
    },
  });

  if (booking) {
    const payments = await prisma.payment.findMany({
      where: {
        bookingId: booking.id,
      },
      orderBy: {
        createdAt: 'desc', // Ambil yang terbaru terlebih dahulu
      },
    });

    if (payments && payments.length > 0) {
      (booking as any).payment = payments[0];
    }
    
    // Tambahkan semua payment ke booking untuk penggunaan baru
    (booking as any).payments = payments;
  }

  return booking as Booking | null;
};

/**
 * Menghitung total pembayaran yang sudah dilakukan untuk sebuah booking
 * Hanya menghitung pembayaran dengan status PAID atau DP_PAID
 */
export const calculateTotalPayments = async (bookingId: number): Promise<number> => {
  const payments = await prisma.payment.findMany({
    where: {
      bookingId: bookingId,
      status: {
        in: [PaymentStatus.PAID, PaymentStatus.DP_PAID]
      }
    },
    select: {
      amount: true
    }
  });
  
  let totalAmount = 0;
  
  // Sum up all payment amounts
  payments.forEach(payment => {
    totalAmount += Number(payment.amount);
  });
  
  return totalAmount;
};

/**
 * Function to mark completed bookings (past endtime) as completed
 * Bookings that have passed their endtime will be marked with a completed status
 */
export const updateCompletedBookings = async (): Promise<void> => {
  try {
    // Find bookings with endtime that has passed
    const currentTime = new Date();

    console.log('🧹 Processing completed bookings at:', currentTime);

    // Find bookings with endtime in the past, status still active, and payment status PAID or DP_PAID
    const completedBookings = await prisma.booking.findMany({
      where: {
        endTime: {
          lt: currentTime, // Only process bookings with endTime in the past
        },
        status: BookingStatus.ACTIVE, // Only process active bookings
        payments: {
          some: {
            status: {
              in: [PaymentStatus.PAID, PaymentStatus.DP_PAID]
            }
          }
        },
      },
      include: {
        field: {
          include: {
            branch: true
          }
        },
        user: true,
        payments: true,
      },
    });

    console.log(`🔍 Found ${completedBookings.length} completed bookings`);

    // Update the booking status to 'completed'
    for (const booking of completedBookings) {
      // Update booking status to completed
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'completed',
        },
      });

      console.log(
        `🔄 Updated booking #${booking.id} status to 'completed'`
      );

      // Emit event to notify system that booking is completed
      emitBookingEvents('booking:updated', {
        booking: booking,
        userId: booking.userId,
        branchId: booking.field?.branchId,
        bookingStatus: 'completed',
      });

      console.log(
        `🔔 Notified system about completed booking #${booking.id}`
      );
    }

    console.log('✅ Completed booking processing completed');
  } catch (error) {
    console.error('❌ Error in updateCompletedBookings:', error);
  }
};

/**
 * Function to update booking status to active when starttime is reached
 * Bookings that have reached their starttime will be marked with an active status
 */
export const updateActiveBookings = async (): Promise<void> => {
  try {
    // Find bookings with starttime that has been reached but not yet completed
    const currentTime = new Date();

    console.log('🔄 Processing active bookings at:', currentTime);

    // Find bookings with startTime in the past, endTime in the future, and status not yet active
    const bookingsToActivate = await prisma.booking.findMany({
      where: {
        startTime: {
          lt: currentTime, // startTime in the past
        },
        endTime: {
          gt: currentTime, // endTime in the future
        },
        status: {
          not: BookingStatus.ACTIVE, // Exclude already active bookings
        },
        payments: {
          some: {
            status: {
              in: [PaymentStatus.PAID, PaymentStatus.DP_PAID]
            }
          }
        },
      },
      include: {
        field: {
          include: {
            branch: true
          }
        },
        payments: true,
      },
    });

    console.log(`🔍 Found ${bookingsToActivate.length} bookings that should be activated`);

    // Update the booking status to 'active'
    for (const booking of bookingsToActivate) {
      // Skip if booking is cancelled
      if (booking.status === BookingStatus.CANCELLED) {
        continue;
      }
      
      // Update booking status to active
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.ACTIVE },
      });

      console.log(`🔄 Updated booking #${booking.id} status to active`);
      
      // Emit event for real-time notifications
      emitBookingEvents('booking:status-updated', { booking });
    }
  } catch (error) {
    console.error('Error updating active bookings:', error);
  }
};

// Export emitBookingEvents for use elsewhere
export { emitBookingEvents };
