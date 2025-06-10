import { Response } from 'express';
import prisma from '../../config/services/database';
import { createBookingSchema } from '../../zod-schemas/booking.schema';
import {
  sendErrorResponse,
  validateBookingTime,
  createBookingWithPayment,
  processMidtransPayment,
  emitBookingEvents,
  calculateTotalPayments,
} from '../../utils/booking/booking.utils';
import { calculateTotalPrice } from '../../utils/booking/calculateBooking.utils';
import { parseISO } from 'date-fns';
import { combineDateAndTime } from '../../utils/date.utils';
import { invalidateBookingCache } from '../../utils/cache/cacheInvalidation.utils';
import { trackFailedBooking, resetFailedBookingCounter } from '../../middlewares/security.middleware';
import { User } from '../../middlewares/auth.middleware';
import { PaymentMethod, PaymentStatus } from '../../types';

/**
 * User Booking Controller
 * Berisi semua operasi booking untuk pengguna biasa
 */

export const createBooking = async (req: User, res: Response): Promise<void> => {
  try {
    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
    
    // Timezone sudah diatur di config/app/env.ts

    // Validasi data dengan Zod
    const result = createBookingSchema.safeParse(req.body);

    if (!result.success) {
      console.error('❌ Validasi gagal:', result.error.format());
      return sendErrorResponse(res, 400, 'Validasi gagal', result.error.format());
    }

    console.log('✅ Data validasi berhasil:', JSON.stringify(result.data, null, 2));

    const { userId, fieldId, bookingDate, startTime, endTime, paymentMethod } = result.data;
    // Jika tidak ada payment method yang dipilih atau bukan CASH, gunakan Midtrans
    const isUsingMidtrans = paymentMethod !== PaymentMethod.CASH;
    
    console.log('💳 Payment Method:', paymentMethod);
    console.log('🔍 Menggunakan Midtrans:', isUsingMidtrans);

    // Convert strings to Date objects
    const bookingDateTime = parseISO(bookingDate);
    
    // Validasi tambahan untuk bookingDate
    if (isNaN(bookingDateTime.getTime())) {
      return sendErrorResponse(res, 400, 'Format tanggal booking tidak valid. Harus dalam format ISO-8601 (YYYY-MM-DD)');
    }
    
    console.log('🗓️ Booking Date:', bookingDateTime.toISOString());

    // Combine date with time in UTC
    // PENTING: startTime bersifat inclusive, endTime bersifat exclusive
    // Contoh: booking 08:00-10:00 berarti dari jam 08:00 sampai 09:59:59
    const startDateTime = combineDateAndTime(bookingDateTime, startTime);
    const endDateTime = combineDateAndTime(bookingDateTime, endTime);

    console.log('⏰ Start Time:', startDateTime.toISOString());
    console.log('⏰ End Time (exclusive):', endDateTime.toISOString());
    console.log('⏰ Durasi booking:', Math.floor((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60)), 'jam');

    // Validate booking time and availability
    const timeValidation = await validateBookingTime(fieldId, bookingDateTime, startDateTime, endDateTime);

    if (!timeValidation.valid) {
      return sendErrorResponse(res, 400, timeValidation.message, timeValidation.details);
    }

    // Get field details for pricing
    const field = await prisma.field.findUnique({
      where: { id: fieldId },
      include: { branch: true },
    });

    console.log('📜 Field details:', field);

    if (!field) {
      return sendErrorResponse(res, 404, 'Field not found');
    }

    // Fetch user details for customer information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true, role: true },
    });

    if (!user) {
      return sendErrorResponse(res, 404, 'User not found');
    }

    // Calculate total price
    const totalPrice = calculateTotalPrice(
      startDateTime,
      endDateTime,
      Number(field.priceDay),
      Number(field.priceNight)
    );

    if (totalPrice <= 0) {
      return sendErrorResponse(res, 400, 'Invalid price calculation');
    }

    console.log('💵 Total price:', totalPrice);

    let initialPaymentStatus = PaymentStatus.PENDING;
    let paymentResult: any = null;

    // Jika pembayaran tunai, status langsung jadi dp_paid untuk user biasa
    if (paymentMethod === PaymentMethod.CASH && user.role === 'user') {
      initialPaymentStatus = PaymentStatus.DP_PAID;
      console.log('💰 Pembayaran tunai di tempat, status: DP_PAID');
    }

    // Create booking with payment status sesuai metode pembayaran
    const { booking, payment } = await createBookingWithPayment(
      userId,
      fieldId,
      bookingDateTime,
      startDateTime,
      endDateTime,
      initialPaymentStatus,
      // Jangan kirim paymentMethod saat awal, kecuali jika cash payment
      isUsingMidtrans ? undefined : paymentMethod,
      totalPrice
    );

    console.log('✅ Booking created:', booking.id);
    console.log('💳 Payment created:', payment.id);
    console.log('💰 Payment method:', isUsingMidtrans ? 'akan ditentukan setelah pembayaran' : paymentMethod);

    // Proses payment gateway jika menggunakan Midtrans
    if (isUsingMidtrans) {
      // Process payment via Midtrans API
      paymentResult = await processMidtransPayment(
        booking,
        payment,
        field as any, // Type casting untuk mengatasi masalah tipe
        user as any, // Type casting untuk mengatasi masalah tipe
        totalPrice,
        PaymentMethod.CREDIT_CARD // Gunakan CREDIT_CARD sebagai default
      );

      if (!paymentResult) {
        // Jika gagal membuat pembayaran, lacak sebagai percobaan gagal
        if (req.user?.id) {
          const clientIP = req.ip || req.socket.remoteAddress || '127.0.0.1';
          await trackFailedBooking(req.user.id, booking.id, clientIP);
        }

        return sendErrorResponse(res, 500, 'Failed to create payment gateway');
      }

      // Update payment record with Midtrans transaction details
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          expiresDate: paymentResult.expiryDate,
          status: PaymentStatus.PENDING,
          transactionId: paymentResult.transaction.transaction_id,
          paymentUrl: paymentResult.transaction.redirect_url,
        },
      });

      console.log('💳 Payment updated with transaction details');
    } else {
      // Untuk metode pembayaran selain Midtrans (Cash/Tunai)
      // Tambahkan data tambahan ke aktivitas untuk pembayaran tunai
      if (paymentMethod === PaymentMethod.CASH) {
        await prisma.activityLog.create({
          data: {
            userId,
            action: 'CASH_PAYMENT_RESERVED',
            details: `Booking #${booking.id} untuk lapangan ${field.name} dijadwalkan dengan pembayaran tunai di tempat`,
            ipAddress: req.ip || undefined,
          },
        });

        // Catat expiry date (24 jam dari sekarang) untuk pembayaran tunai
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 24);

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            expiresDate: expiryDate,
          },
        });
      }
    }

    // Reset counter jika booking berhasil dibuat (status pending tetap dianggap berhasil)
    if (req.user?.id) {
      resetFailedBookingCounter(req.user.id);
    }

    // Emit real-time events via Socket.IO
    emitBookingEvents('booking:created', { booking, payment });

    // Clear any cached data that might be affected by this new booking
    await invalidateBookingCache(booking.id, fieldId, field.branchId, userId);

    // Return response with booking and payment details
    res.status(201).json({
      booking: {
        ...booking,
        field,
        payments: [
          {
            ...payment,
            paymentUrl: paymentResult?.transaction?.redirect_url || null,
            status: payment.status,
          },
        ],
      },
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    sendErrorResponse(res, 500, 'Internal Server Error', error);
  }
};

export const getUserBookings = async (req: User, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const parsedUserId = parseInt(userId);
    const { statusPayment } = req.query;

    if (isNaN(parsedUserId)) {
      return sendErrorResponse(res, 400, 'Invalid user ID');
    }

    let whereCondition: any = {userId: parsedUserId};

    if (statusPayment !== undefined) {
      whereCondition.payments = {
        some: { status: statusPayment }
      };
    }


    const bookings = await prisma.booking.findMany({
      where: whereCondition,
      include: {
        field: {
          include: {
            branch: {
              select: { id: true, name: true, location: true, imageUrl: true },
            },
            type: true,
          },
        },
        payments: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error getting user bookings:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const getBookingById = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);

    if (isNaN(bookingId)) {
      return sendErrorResponse(res, 400, 'ID booking tidak valid');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: {
          include: {
            branch: {
              select: { id: true, name: true, location: true, imageUrl: true },
            },
            type: true,
          },
        },
        payments: true,
      },
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking tidak ditemukan');
    }

    res.status(200).json(booking);
  } catch (error) {
    console.error('Error getting booking by ID:', error);
    sendErrorResponse(res, 500, 'Kesalahan Server Internal');
  }
};

export const cancelBooking = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);

    if (isNaN(bookingId)) {
      return sendErrorResponse(res, 400, 'Invalid booking ID');
    }

    // Get current booking with payment info
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: true,
        field: { select: { id: true, branchId: true } },
      },
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found');
    }

    // Only allow cancellation of pending and unpaid bookings
    if (booking.payments && booking.payments.some(p => p.status === PaymentStatus.PAID)) {
      return sendErrorResponse(res, 400, 'Cannot cancel a booking that has been paid. Please contact administrator.');
    }

    // Delete payments first (foreign key constraint)
    if (booking.payments && booking.payments.length > 0) {
      for (const payment of booking.payments) {
        await prisma.payment.delete({
          where: { id: payment.id },
        });
      }
    }

    // Then delete booking
    await prisma.booking.delete({
      where: { id: bookingId },
    });

    // Invalidate cache
    const fieldId = booking.fieldId;
    const branchId = booking.field?.branchId || 0;
    await invalidateBookingCache(bookingId, fieldId, branchId, booking.userId);

    // Emit booking cancelled event
    emitBookingEvents('booking:cancelled', { bookingId });

    res.status(200).json({
      status: true,
      message: 'Booking berhasil dibatalkan',
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

/**
 * Fungsi untuk membuat pelunasan dari pembayaran DP yang sudah ada
 * Khusus untuk user dengan pembayaran via Midtrans
 */
export const createPaymentCompletion = async (req: User, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const { paymentMethod } = req.body;
    // Default payment method untuk user adalah Credit Card jika tidak spesifik
    const selectedPaymentMethod = paymentMethod || PaymentMethod.CREDIT_CARD;
    
    // Pastikan metode pembayaran bukan CASH untuk user
    if (selectedPaymentMethod === PaymentMethod.CASH) {
      return sendErrorResponse(res, 400, 'User tidak dapat menggunakan metode pembayaran tunai untuk pelunasan');
    }
    
    // Pastikan user hanya bisa mengakses bookingnya sendiri
    const bookingIdInt = parseInt(bookingId);
    
    // Cari booking dan payment DP-nya
    const booking = await prisma.booking.findFirst({
      where: { 
        id: bookingIdInt,
        userId: req.user?.id // Pastikan booking milik user yang request
      },
      include: {
        field: {
          include: { branch: true }
        },
        user: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking tidak ditemukan atau Anda tidak memiliki akses');
    }

    // Cari semua payment yang terkait dengan booking ini
    const payments = await prisma.payment.findMany({
      where: { bookingId: bookingIdInt }
    });
    
    // Periksa apakah ada pembayaran dengan status PAID (sudah lunas)
    const paidPayment = payments.find(p => p.status === PaymentStatus.PAID);
    if (paidPayment) {
      return sendErrorResponse(res, 400, 'Booking ini sudah lunas dan tidak memerlukan pelunasan');
    }
    
    const dpPayment = payments.find(p => p.status === PaymentStatus.DP_PAID);
    
    if (!dpPayment) {
      return sendErrorResponse(res, 400, 'Booking ini tidak memiliki pembayaran DP yang perlu dilunasi');
    }
    
    // Periksa apakah sudah ada pembayaran pelunasan yang pending
    const pendingCompletionPayment = payments.find(p => 
      p.status === PaymentStatus.PENDING && 
      p.id !== dpPayment.id
    );
    
    if (pendingCompletionPayment) {
      return sendErrorResponse(
        res, 
        400, 
        'Sudah ada pembayaran pelunasan yang sedang menunggu pembayaran. Silakan selesaikan pembayaran tersebut terlebih dahulu.',
        { paymentUrl: pendingCompletionPayment.paymentUrl }
      );
    }
    
    // Calculate total price
    const totalPrice = calculateTotalPrice(
      booking.startTime,
      booking.endTime,
      Number(booking.field.priceDay),
      Number(booking.field.priceNight)
    );

    // Hitung total yang sudah dibayarkan
    const totalPaid = await calculateTotalPayments(bookingIdInt);
    
    // Hitung sisa pembayaran
    const remainingAmount = totalPrice - totalPaid;
    console.log(`💵 Total harga: ${totalPrice}, Total dibayar: ${totalPaid}, Sisa: ${remainingAmount}`);
    
    // Pastikan masih ada sisa pembayaran
    if (remainingAmount <= 0) {
      return sendErrorResponse(res, 400, 'Pembayaran untuk booking ini sudah lunas');
    }
    
    // Buat payment baru untuk pelunasan
    let paymentResult: any = null;
    
    // Buat payment baru untuk pelunasan
    const completionPayment = await prisma.payment.create({
      data: {
        bookingId: bookingIdInt,
        userId: booking.userId,
        amount: remainingAmount,
        status: PaymentStatus.PENDING, // Mulai dengan pending, akan diubah ke PAID setelah proses
        paymentMethod: selectedPaymentMethod,
      }
    });

    // Proses pembayaran via Midtrans API (user selalu pakai Midtrans)
    if (booking.user) {
      try {
        // Process payment via Midtrans API
        paymentResult = await processMidtransPayment(
          booking as any,
          completionPayment as any, // Gunakan type assertion untuk mengatasi masalah tipe
          booking.field as any,
          booking.user as any,
          remainingAmount,
          selectedPaymentMethod as PaymentMethod
        );

        if (paymentResult) {
          // Update payment record with Midtrans transaction details
          await prisma.payment.update({
            where: { id: completionPayment.id },
            data: {
              expiresDate: paymentResult.expiryDate,
              transactionId: paymentResult.transaction.transaction_id,
              paymentUrl: paymentResult.transaction.redirect_url,
            },
          });
        }
      } catch (error) {
        console.error('Error processing Midtrans payment:', error);
        // Hapus payment jika gagal membuat transaksi Midtrans
        await prisma.payment.delete({
          where: { id: completionPayment.id }
        });
        return sendErrorResponse(res, 500, 'Gagal membuat transaksi pembayaran');
      }
    } else {
      // Hapus payment jika user tidak ditemukan
      await prisma.payment.delete({
        where: { id: completionPayment.id }
      });
      return sendErrorResponse(res, 500, 'Data user tidak lengkap');
    }

    // Tambahkan log aktivitas
    await prisma.activityLog.create({
      data: {
        userId: req.user?.id || 0,
        action: 'USER_PAYMENT_COMPLETION_CREATED',
        details: `User membuat pelunasan untuk booking #${bookingId} dengan metode ${selectedPaymentMethod}`,
        ipAddress: req.ip || undefined,
      }
    });

    // Reset counter jika pembayaran berhasil dibuat
    resetFailedBookingCounter(req.user?.id || 0);

    // Emit WebSocket event untuk perubahan status pembayaran
    emitBookingEvents('payment:completion', {
      booking,
      userId: booking.userId,
      branchId: booking.field.branchId,
      paymentId: completionPayment.id,
      paymentMethod: selectedPaymentMethod,
    });

    // Hapus cache yang terkait booking
    await invalidateBookingCache(
      bookingIdInt,
      booking.fieldId,
      booking.field.branchId,
      booking.userId
    );

    res.status(201).json({
      status: true,
      message: 'Link pembayaran pelunasan berhasil dibuat',
      data: {
        payment: completionPayment,
        paymentUrl: paymentResult?.transaction?.redirect_url || null,
      }
    });
  } catch (error) {
    console.error('Error creating payment completion:', error);
    sendErrorResponse(res, 500, 'Terjadi kesalahan saat membuat pelunasan');
  }
};
