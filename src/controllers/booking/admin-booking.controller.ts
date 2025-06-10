import { Response } from 'express';
import prisma from '../../config/services/database';
import {
  sendErrorResponse,
  validateBookingTime,
  createBookingWithPayment,
  emitBookingEvents,
  getCompleteBooking,
  verifyFieldBranch,
  processMidtransPayment,
  calculateTotalPayments,
} from '../../utils/booking/booking.utils';
import { calculateTotalPrice } from '../../utils/booking/calculateBooking.utils';
import { invalidateBookingCache } from '../../utils/cache/cacheInvalidation.utils';
import { User } from '../../middlewares/auth.middleware';
import { PaymentMethod, PaymentStatus } from '../../types';
import { parseISO } from 'date-fns';
import { combineDateAndTime } from '../../utils/date.utils';
import { createBookingSchema } from '../../zod-schemas/booking.schema';
import { resetFailedBookingCounter } from '../../middlewares/security.middleware';

/**
 * Branch Admin Booking Controller
 * Berisi semua operasi booking yang dapat dilakukan oleh admin cabang
 */

export const getBranchBookings = async (req: User, res: Response): Promise<void> => {
  try {
    // Dari middleware auth kita sudah punya branchId di req.userBranch
    const branchIdFromAuth = req.userBranch?.id;
    const { status, startDate, endDate, search } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;

    // Ambil branchId dari parameter URL jika ada
    const branchIdFromParams = req.params.branchId ? parseInt(req.params.branchId) : null;
    
    console.log('Auth branch ID:', branchIdFromAuth);
    console.log('Params branch ID:', branchIdFromParams);

    if (!branchIdFromAuth) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat mengakses semua cabang
    // Admin cabang hanya dapat mengakses cabang yang ditugaskan
    let branchId = branchIdFromAuth;
    
    // Jika super admin (branchId = 0) dan ada parameter branchId, gunakan parameter
    if (branchIdFromAuth === 0 && branchIdFromParams) {
      branchId = branchIdFromParams;
    } 
    // Jika admin cabang, periksa apakah dia memiliki akses ke cabang yang diminta
    else if (branchIdFromParams && branchIdFromParams !== branchIdFromAuth) {
      // Periksa apakah admin cabang ini juga memiliki akses ke cabang yang diminta
      const hasAccess = await prisma.branchAdmin.findFirst({
        where: {
          userId: req.user?.id,
          branchId: branchIdFromParams
        }
      });
      
      if (hasAccess) {
        branchId = branchIdFromParams;
      } else {
        console.log(`Admin cabang ${req.user?.id} tidak memiliki akses ke cabang ${branchIdFromParams}`);
        // Tetap gunakan cabang dari auth jika tidak memiliki akses
      }
    }

    console.log('Fetching bookings with filters:', {
      branchId,
      status,
      startDate,
      endDate,
      search
    });

    // Build base where condition dengan branch
    let whereCondition: any = {
      field: {
        is: {
          branchId: branchId
        }
      }
    };

    console.log('Where condition after branch filter:', JSON.stringify(whereCondition));

    // Tambahkan filter status jika ada
    if (status) {
      whereCondition = {
        ...whereCondition,
        payments: {
          some: {
            status: status as string
          }
        }
      };
    }

    // Tambahkan filter tanggal jika ada
    if (startDate && endDate) {
      whereCondition = {
        ...whereCondition,
        bookingDate: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      };
    } else if (startDate) {
      whereCondition = {
        ...whereCondition,
        bookingDate: {
          gte: new Date(startDate as string)
        }
      };
    } else if (endDate) {
      whereCondition = {
        ...whereCondition,
        bookingDate: {
          lte: new Date(endDate as string)
        }
      };
    }

    const totalItems = await prisma.booking.count({
      where: whereCondition,
    });

    // Get all bookings for fields in this branch
    const bookings = await prisma.booking.findMany({
      where: whereCondition,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: { 
          include: { 
            branch: {
              select: { id: true, name: true, location: true, imageUrl: true }
            }
          } 
        },
        payments: true,
      },
      orderBy: { bookingDate: 'desc' },
    });

    console.log(`Found ${bookings.length} bookings for branch ${branchId}`);
    if (bookings.length > 0) {
      console.log('Sample booking field data:', JSON.stringify(bookings[0].field));
    }

    // Filter by search term jika diperlukan (karena Prisma tidak mendukung OR untuk relasi)
    let filteredBookings = bookings;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredBookings = bookings.filter(booking => 
        booking.user?.name?.toLowerCase().includes(searchTerm) ||
        booking.field?.name?.toLowerCase().includes(searchTerm) ||
        booking.id.toString().includes(searchTerm)
      );
    }

    res.status(200).json({
      data: filteredBookings,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error('Error getting branch bookings:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const getBranchBookingById = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);
    const branchId = req.userBranch?.id;

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat melihat booking dari branch tertentu
    const whereCondition = branchId === 0 ? { id: bookingId } : { id: bookingId, field: { branchId } };

    const booking = await prisma.booking.findFirst({
      where: whereCondition,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: { include: { branch: true, type: true } },
        payments: true,
      },
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found for this branch');
    }

    res.status(200).json(booking);
  } catch (error) {
    console.error('Error getting branch booking by ID:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const updateBranchBookingStatus = async (req: User, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id);
    const branchId = req.userBranch?.id;
    const { paymentStatus } = req.body;

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat mengupdate booking dari branch tertentu
    const whereCondition = branchId === 0 ? { id: bookingId } : { id: bookingId, field: { branchId } };

    // Verify the booking belongs to this branch
    const booking = await prisma.booking.findFirst({
      where: whereCondition,
      include: {
        payments: true,
        user: { select: { id: true } },
        field: { include: { branch: true } },
      },
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found for this branch');
    }

    // Update payment status
    if (booking.payments && booking.payments.length > 0 && paymentStatus) {
      await prisma.payment.update({
        where: { id: booking.payments[0].id },
        data: { status: paymentStatus },
      });
    }

    // Return updated booking
    const updatedBooking = await getCompleteBooking(bookingId);

    // Emit WebSocket event for booking update
    emitBookingEvents('update-payment', {
      booking: updatedBooking,
      userId: booking.user?.id,
      branchId,
      paymentStatus,
    });

    // Hapus cache yang terkait booking
    await invalidateBookingCache(bookingId, booking.fieldId, booking.field.branchId, booking.userId);

    res.status(200).json({
      status: true,
      message: 'Status booking berhasil diperbarui',
      data: updatedBooking,
    });
  } catch (error) {
    console.error('Error updating branch booking status:', error);
    sendErrorResponse(res, 400, 'Failed to update booking');
  }
};

export const markPaymentAsPaid = async (req: User, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const { paymentMethod } = req.body;
    const selectedPaymentMethod = paymentMethod || PaymentMethod.CASH;

    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId) },
      include: {
        booking: {
          include: {
            field: true,
            user: { select: { id: true, name: true, email: true, role: true } }
          }
        }
      }
    });

    if (!payment) {
      return sendErrorResponse(res, 404, 'Pembayaran tidak ditemukan');
    }

    // Pastikan admin cabang hanya dapat memperbarui booking di cabang yang mereka kelola
    const branchId = req.userBranch?.id;
    if (branchId !== 0 && payment.booking.field.branchId !== branchId) {
      return sendErrorResponse(res, 403, 'Anda tidak memiliki akses untuk memperbarui pembayaran ini');
    }

    // Tentukan status pembayaran berdasarkan role pengguna
    const paymentStatus = payment.booking.user.role === 'user' 
      ? PaymentStatus.DP_PAID  // User biasa mendapat status DP_PAID
      : PaymentStatus.PAID;    // Admin/owner mendapat status PAID
    
    // Perbarui status pembayaran dan metode pembayaran
    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(paymentId) },
      data: { 
        status: paymentStatus,
        paymentMethod: selectedPaymentMethod
      }
    });

    // Emit WebSocket event untuk perubahan status pembayaran
    emitBookingEvents('update-payment', {
      booking: payment.booking,
      userId: payment.booking.userId,
      branchId: payment.booking.field.branchId,
      paymentStatus: paymentStatus,
    });

    // Tambahkan log aktivitas
    await prisma.activityLog.create({
      data: {
        userId: req.user?.id || 0,
        action: 'PAYMENT_MARKED_AS_PAID',
        details: `Admin menandai pembayaran #${paymentId} sebagai ${paymentStatus} dengan metode ${selectedPaymentMethod}`,
        ipAddress: req.ip || undefined,
      }
    });

    // Hapus cache yang terkait booking
    await invalidateBookingCache(
      payment.bookingId, 
      payment.booking.fieldId, 
      payment.booking.field.branchId, 
      payment.booking.userId
    );

    res.status(200).json({
      status: true,
      message: `Pembayaran berhasil ditandai sebagai ${paymentStatus === PaymentStatus.DP_PAID ? 'uang muka' : 'lunas'} dengan metode ${selectedPaymentMethod}`,
      data: updatedPayment
    });
  } catch (error) {
    console.error('Error marking payment as paid:', error);
    sendErrorResponse(res, 500, 'Terjadi kesalahan saat melunasi pembayaran');
  }
};

export const updatePaymentStatus = async (req: User, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const { status, paymentMethod } = req.body;

    if (!status) {
      return sendErrorResponse(res, 400, 'Status pembayaran diperlukan');
    }

    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId) },
      include: {
        booking: {
          include: {
            field: true,
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    if (!payment) {
      return sendErrorResponse(res, 404, 'Pembayaran tidak ditemukan');
    }

    // Pastikan admin cabang hanya dapat memperbarui booking di cabang yang mereka kelola
    const branchId = req.userBranch?.id;
    if (branchId !== 0 && payment.booking.field.branchId !== branchId) {
      return sendErrorResponse(res, 403, 'Anda tidak memiliki akses untuk memperbarui pembayaran ini');
    }

    // Persiapkan data untuk update
    const updateData: any = { status };
    
    // Jika paymentMethod diberikan, tambahkan ke data update
    if (paymentMethod) {
      updateData.paymentMethod = paymentMethod;
    }

    // Perbarui status pembayaran dan metode pembayaran (jika diberikan)
    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(paymentId) },
      data: updateData
    });

    // Emit WebSocket event untuk perubahan status pembayaran
    emitBookingEvents('update-payment', {
      booking: payment.booking,
      userId: payment.booking.userId,
      branchId: payment.booking.field.branchId,
      paymentStatus: status,
    });
    
    // Tambahkan log aktivitas
    await prisma.activityLog.create({
      data: {
        userId: req.user?.id || 0,
        action: 'PAYMENT_STATUS_UPDATED',
        details: `Admin mengubah status pembayaran #${paymentId} menjadi ${status}${paymentMethod ? ` dengan metode ${paymentMethod}` : ''}`,
        ipAddress: req.ip || undefined,
      }
    });

    // Hapus cache yang terkait booking
    await invalidateBookingCache(
      payment.bookingId, 
      payment.booking.fieldId, 
      payment.booking.field.branchId, 
      payment.booking.userId
    );

    res.status(200).json({
      status: true,
      message: `Status pembayaran berhasil diperbarui menjadi ${status}${paymentMethod ? ` dengan metode ${paymentMethod}` : ''}`,
      data: updatedPayment
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    sendErrorResponse(res, 500, 'Terjadi kesalahan saat memperbarui status pembayaran');
  }
};

/**
 * Fungsi booking untuk admin yang menggabungkan fungsionalitas createManualBooking dan createAdminBooking
 * Mendukung pembayaran PAID langsung lunas baik untuk cash maupun Midtrans
 */
export const createAdminBooking = async (req: User, res: Response): Promise<void> => {
  try {
    console.log('📥 Request body dari admin:', JSON.stringify(req.body, null, 2));
    
    // Cek branchId dari admin
    const branchId = req.userBranch?.id;
    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID diperlukan');
    }

    // Validasi data dengan Zod
    const result = createBookingSchema.safeParse(req.body);

    if (!result.success) {
      console.error('❌ Validasi gagal:', result.error.format());
      return sendErrorResponse(res, 400, 'Validasi gagal', result.error.format());
    }

    console.log('✅ Data validasi berhasil:', JSON.stringify(result.data, null, 2));

    const { userId, fieldId, bookingDate, startTime, endTime, paymentMethod } = result.data;
    
    // Tentukan apakah menggunakan Midtrans
    const isUsingMidtrans = paymentMethod !== PaymentMethod.CASH;
    
    console.log('💳 Metode Pembayaran:', paymentMethod);
    console.log('🔍 Menggunakan Midtrans:', isUsingMidtrans);

    // Super admin dapat membuat booking untuk branch tertentu
    const whereBranchCondition = branchId === 0 && req.body.branchId ? parseInt(req.body.branchId) : branchId;

    // Verify the field belongs to this branch
    const field = await verifyFieldBranch(fieldId, whereBranchCondition);

    if (!field) {
      return sendErrorResponse(res, 404, 'Lapangan tidak ditemukan di cabang ini');
    }

    // Convert strings to Date objects
    const bookingDateTime = parseISO(bookingDate);
    
    // Validasi tambahan untuk bookingDate
    if (isNaN(bookingDateTime.getTime())) {
      return sendErrorResponse(res, 400, 'Format tanggal booking tidak valid. Harus dalam format ISO-8601 (YYYY-MM-DD)');
    }
    
    console.log('🗓️ Booking Date:', bookingDateTime.toISOString());

    // Combine date with time in UTC
    const startDateTime = combineDateAndTime(bookingDateTime, startTime);
    const endDateTime = combineDateAndTime(bookingDateTime, endTime);

    console.log('⏰ Start Time:', startDateTime.toISOString());
    console.log('⏰ End Time:', endDateTime.toISOString());
    console.log('⏰ Durasi booking:', Math.floor((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60)), 'jam');

    // Validate booking time and availability
    const timeValidation = await validateBookingTime(fieldId, bookingDateTime, startDateTime, endDateTime);

    if (!timeValidation.valid) {
      return sendErrorResponse(res, 400, timeValidation.message, timeValidation.details);
    }

    // Fetch user details for customer information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true, role: true },
    });

    if (!user) {
      return sendErrorResponse(res, 404, 'Pengguna tidak ditemukan');
    }

    // Calculate total price
    const totalPrice = calculateTotalPrice(
      startDateTime,
      endDateTime,
      Number(field.priceDay),
      Number(field.priceNight)
    );

    if (totalPrice <= 0) {
      return sendErrorResponse(res, 400, 'Perhitungan harga tidak valid');
    }

    console.log('💵 Total harga:', totalPrice);

    // Gunakan status pembayaran dari request body jika ada, jika tidak default ke PAID
    const paymentStatus = req.body.paymentStatus || PaymentStatus.PAID;
    console.log('💰 Status pembayaran:', paymentStatus);
    
    let paymentResult: any = null;

    // Create booking with payment status sesuai pilihan
    const { booking, payment } = await createBookingWithPayment(
      userId,
      fieldId,
      bookingDateTime,
      startDateTime,
      endDateTime,
      paymentStatus,
      // Untuk booking Midtrans, tetap kirim paymentMethod agar dicatat di database
      paymentMethod,
      totalPrice
    );

    console.log('✅ Booking admin berhasil dibuat:', booking.id);
    console.log('💳 Pembayaran dibuat:', payment.id);
    console.log('💰 Metode pembayaran:', paymentMethod);

    // Proses payment gateway jika menggunakan Midtrans
    if (isUsingMidtrans) {
      try {
        // Process payment via Midtrans API
        paymentResult = await processMidtransPayment(
          booking,
          payment,
          field as any,
          user as any,
          totalPrice,
          paymentMethod as PaymentMethod
        );

        if (paymentResult) {
          // Update payment record with Midtrans transaction details
          // Gunakan status pembayaran yang dipilih
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              expiresDate: paymentResult.expiryDate,
              status: paymentStatus, // Gunakan status pembayaran yang dipilih
              transactionId: paymentResult.transaction.transaction_id,
              paymentUrl: paymentResult.transaction.redirect_url,
            },
          });

          console.log('💳 Pembayaran diperbarui dengan detail transaksi');
        }
      } catch (error) {
        console.error('Error processing payment with Midtrans:', error);
        // Tetap lanjutkan meskipun ada error dengan Midtrans
        // Karena booking sudah dibuat dengan status yang dipilih
      }
    }

    // Tambahkan log aktivitas
    await prisma.activityLog.create({
      data: {
        userId: req.user?.id || 0,
        action: 'ADMIN_BOOKING_CREATED',
        details: `Admin membuat booking #${booking.id} untuk lapangan ${field.name} dengan pembayaran ${paymentMethod} (status: ${paymentStatus})`,
        ipAddress: req.ip || undefined,
      },
    });
    
    // Untuk metode pembayaran tunai, tambahkan expiry date
    if (paymentMethod === PaymentMethod.CASH) {
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

    // Reset counter jika booking berhasil dibuat
    if (req.user?.id) {
      resetFailedBookingCounter(req.user.id);
    }

    // Emit real-time events
    emitBookingEvents('booking:created', { booking, payment });

    // Invalidate cache
    await invalidateBookingCache(booking.id, fieldId, whereBranchCondition, userId);

    // Pesan sesuai status pembayaran
    const statusMessage = paymentStatus === PaymentStatus.PAID 
      ? 'lunas' 
      : 'down payment';

    res.status(201).json({
      status: true,
      message: isUsingMidtrans 
        ? `Booking berhasil dibuat dengan pembayaran online (status ${statusMessage})`
        : `Booking berhasil dibuat dengan pembayaran tunai (status ${statusMessage})`,
      data: {
        booking,
        payment,
        paymentUrl: paymentResult?.transaction?.redirect_url || null,
      },
    });
  } catch (error) {
    console.error('Error creating admin booking:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

/**
 * Fungsi booking manual untuk kompatibilitas dengan API lama
 * Meneruskan ke createAdminBooking
 */
export const createManualBooking = async (req: User, res: Response): Promise<void> => {
  try {
    console.log('📥 Request createManualBooking dialihkan ke createAdminBooking');
    
    // Modifikasi format body untuk memenuhi skema createBookingSchema
    const { fieldId, userId, bookingDate, startTime, endTime, paymentMethod, paymentStatus } = req.body;
    
    // Default ke CASH jika tidak ada paymentMethod
    const selectedPaymentMethod = paymentMethod || PaymentMethod.CASH;
    
    // Buat request body baru untuk createAdminBooking
    req.body = {
      fieldId,
      userId: userId || req.user?.id,
      bookingDate,
      startTime, 
      endTime,
      paymentMethod: selectedPaymentMethod,
      // Sertakan paymentStatus jika ada
      ...(paymentStatus ? { paymentStatus } : {}),
      // Sertakan branchId jika ada
      ...(req.body.branchId ? { branchId: req.body.branchId } : {})
    };
    
    // Delegasikan ke createAdminBooking
    return createAdminBooking(req, res);
  } catch (error) {
    console.error('Error in createManualBooking:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

/**
 * Fungsi untuk membuat pelunasan dari pembayaran DP yang sudah ada
 * Khusus untuk admin dengan pembayaran cash/tunai
 */
export const createPaymentCompletion = async (req: User, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const { paymentMethod } = req.body;
    // Default payment method untuk admin adalah CASH
    const selectedPaymentMethod = paymentMethod || PaymentMethod.CASH;
    
    // Cari booking dan payment DP-nya
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        field: {
          include: { branch: true }
        },
        user: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking tidak ditemukan');
    }

    // Cari semua payment yang terkait dengan booking ini
    const payments = await prisma.payment.findMany({
      where: { bookingId: parseInt(bookingId) }
    });
    
    // Periksa apakah ada pembayaran dengan status PAID (sudah lunas)
    const paidPayment = payments.find(p => p.status === PaymentStatus.PAID);
    
    // Calculate total price
    const totalPrice = calculateTotalPrice(
      booking.startTime,
      booking.endTime,
      Number(booking.field.priceDay),
      Number(booking.field.priceNight)
    );

    // Hitung total yang sudah dibayarkan
    const totalPaid = await calculateTotalPayments(parseInt(bookingId));
    
    // Periksa apakah booking sudah lunas berdasarkan total pembayaran atau status PAID
    if (totalPaid >= totalPrice || paidPayment) {
      return sendErrorResponse(res, 400, 'Booking ini sudah lunas dan tidak memerlukan pelunasan');
    }
    
    const dpPayment = payments.find(p => p.status === PaymentStatus.DP_PAID);
    
    if (!dpPayment) {
      return sendErrorResponse(res, 400, 'Booking ini tidak memiliki pembayaran DP yang perlu dilunasi');
    }

    // Cek apakah sudah ada pembayaran pelunasan yang pending
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
    
    // Pastikan admin cabang hanya dapat memperbarui booking di cabang yang mereka kelola
    const branchId = req.userBranch?.id;
    if (branchId !== 0 && booking.field.branchId !== branchId) {
      return sendErrorResponse(res, 403, 'Anda tidak memiliki akses untuk memperbarui pembayaran ini');
    }
    
    // Hitung sisa pembayaran
    const remainingAmount = totalPrice - totalPaid;
    console.log(`💵 Total harga: ${totalPrice}, Total dibayar: ${totalPaid}, Sisa: ${remainingAmount}`);
    
    // Pastikan masih ada sisa pembayaran
    if (remainingAmount <= 0) {
      return sendErrorResponse(res, 400, 'Pembayaran untuk booking ini sudah lunas');
    }
    
    // Buat payment baru untuk pelunasan
    let paymentResult: any = null;
    const isUsingMidtrans = selectedPaymentMethod !== PaymentMethod.CASH;
    
    // Buat payment baru untuk pelunasan
    const completionPayment = await prisma.payment.create({
      data: {
        bookingId: parseInt(bookingId),
        userId: booking.userId,
        amount: remainingAmount,
        status: isUsingMidtrans ? PaymentStatus.PENDING : PaymentStatus.PAID, // Admin dapat langsung tandai PAID jika cash
        paymentMethod: selectedPaymentMethod,
      }
    });

    // Jika menggunakan Midtrans (khusus admin yang pilih metode online), proses pembayaran via Midtrans API
    if (isUsingMidtrans && booking.user) {
      try {
        // Process payment via Midtrans API
        paymentResult = await processMidtransPayment(
          booking as any,
          completionPayment as any,
          booking.field as any,
          booking.user as any,
          remainingAmount,
          selectedPaymentMethod as PaymentMethod,
          true // isCompletion=true untuk menandakan ini adalah pelunasan
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
    } else if (!isUsingMidtrans) {
      // Untuk pembayaran tunai, langsung tandai sebagai lunas
      await prisma.payment.update({
        where: { id: completionPayment.id },
        data: {
          // Pembayaran tunai tidak perlu expiry date karena sudah PAID
          status: PaymentStatus.PAID
        }
      });
    }

    // Tambahkan log aktivitas
    await prisma.activityLog.create({
      data: {
        userId: req.user?.id || 0,
        action: 'ADMIN_PAYMENT_COMPLETION_CREATED',
        details: `Admin membuat pelunasan untuk booking #${bookingId} dengan metode ${selectedPaymentMethod}`,
        ipAddress: req.ip || undefined,
      }
    });

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
      parseInt(bookingId),
      booking.fieldId,
      booking.field.branchId,
      booking.userId
    );

    res.status(201).json({
      status: true,
      message: isUsingMidtrans ? 'Link pembayaran pelunasan berhasil dibuat' : 'Pelunasan berhasil dibuat dan ditandai sebagai lunas',
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
