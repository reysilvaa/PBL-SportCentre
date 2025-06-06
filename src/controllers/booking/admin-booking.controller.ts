import { Response } from 'express';
import prisma from '../../config/services/database';
import {
  sendErrorResponse,
  validateBookingTime,
  createBookingWithPayment,
  emitBookingEvents,
  getCompleteBooking,
  verifyFieldBranch,
} from '../../utils/booking/booking.utils';
import { calculateTotalPrice, combineDateWithTime } from '../../utils/booking/calculateBooking.utils';
import { invalidateBookingCache } from '../../utils/cache/cacheInvalidation.utils';
import { User } from '../../middlewares/auth.middleware';
import { PaymentMethod, PaymentStatus } from '../../types';

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
        payment: {
          status: status as string
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
        payment: true,
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
        payment: true,
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
        payment: true,
        user: { select: { id: true } },
        field: { include: { branch: true } },
      },
    });

    if (!booking) {
      return sendErrorResponse(res, 404, 'Booking not found for this branch');
    }

    // Update payment status
    if (booking.payment && paymentStatus) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
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

export const createManualBooking = async (req: User, res: Response): Promise<void> => {
  try {
    const branchId = req.userBranch?.id;
    const { fieldId, userId, bookingDate, startTime, endTime } = req.body;
    const paymentStatus = PaymentStatus.PAID;
    const paymentMethod = PaymentMethod.CASH;

    console.log('📑 Admin membuat booking manual:');
    console.log('👤 User ID:', userId);
    console.log('🏟️ Field ID:', fieldId);
    console.log('📅 Booking Date:', bookingDate);
    console.log('🕒 Start Time:', startTime);
    console.log('🕒 End Time:', endTime);
    console.log('🌐 Timezone server:', process.env.TZ);
    console.log('🌐 Waktu server saat ini:', new Date().toString());

    if (!branchId) {
      return sendErrorResponse(res, 400, 'Branch ID is required');
    }

    // Super admin dapat membuat booking untuk branch tertentu
    const whereBranchCondition = branchId === 0 && req.body.branchId ? parseInt(req.body.branchId) : branchId;

    // Verify the field belongs to this branch
    const field = await verifyFieldBranch(parseInt(fieldId), whereBranchCondition);

    if (!field) {
      return sendErrorResponse(res, 404, 'Field not found in this branch');
    }

    // Ensure we have a proper date object
    let bookingDateTime;
    try {
      bookingDateTime = new Date(bookingDate);
      if (isNaN(bookingDateTime.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      console.error('❌ Error parsing booking date:', error);
      
      try {
        // Coba parse format YYYY-MM-DD
        const [year, month, day] = bookingDate.split('-').map(Number);
        bookingDateTime = new Date(year, month - 1, day);
        
        if (isNaN(bookingDateTime.getTime())) {
          throw new Error('Invalid date components');
        }
      } catch (error) {
        console.error('❌ Semua percobaan parsing tanggal gagal:', error);
        return sendErrorResponse(res, 400, 'Format tanggal booking tidak valid. Gunakan format YYYY-MM-DD');
      }
    }
    
    console.log('📆 Booking Date (parsed):', bookingDateTime.toISOString());
    console.log('📆 Booking Date (local):', bookingDateTime.toString());

    console.log('🔄 Menggabungkan tanggal dan waktu untuk booking manual...');
    const startDateTime = combineDateWithTime(bookingDateTime, startTime);
    const endDateTime = combineDateWithTime(bookingDateTime, endTime);

    console.log('⏰ Start Date Time (UTC):', startDateTime.toISOString());
    console.log('⏰ End Date Time (UTC):', endDateTime.toISOString());
    console.log('⏰ Start Date Time (local):', startDateTime.toString());
    console.log('⏰ End Date Time (local):', endDateTime.toString());

    // Validate booking time and availability
    const timeValidation = await validateBookingTime(parseInt(fieldId), bookingDateTime, startDateTime, endDateTime);

    if (!timeValidation.valid) {
      return sendErrorResponse(res, 400, timeValidation.message, timeValidation.details);
    }

    // Calculate price
    const totalPrice = calculateTotalPrice(
      startDateTime,
      endDateTime,
      Number(field.priceDay),
      Number(field.priceNight)
    );

  
    const bookingUserId = userId ? parseInt(userId) : req.user?.id;

    if (!bookingUserId) {
      return sendErrorResponse(res, 400, 'User ID is required');
    }

    // Create booking and payment records - selalu set PAID untuk admin cabang
    const { booking, payment } = await createBookingWithPayment(
      bookingUserId,
      parseInt(fieldId),
      bookingDateTime,
      startDateTime,
      endDateTime,
      paymentStatus,
      paymentMethod,
      totalPrice
    );

    console.log('✅ Booking manual berhasil dibuat:');
    console.log('📋 Booking ID:', booking.id);
    console.log('📅 Booking Date:', booking.bookingDate);
    console.log('⏰ Start Time:', booking.startTime);
    console.log('⏰ End Time:', booking.endTime);

    // Emit real-time events
    emitBookingEvents('booking:created', { booking, payment });

    // Invalidate cache
    await invalidateBookingCache(booking.id, parseInt(fieldId), whereBranchCondition, bookingUserId);

    res.status(201).json({
      status: true,
      message: 'Booking manual berhasil dibuat dengan pembayaran cash',
      data: {
        booking,
        payment,
      },
    });
  } catch (error) {
    console.error('Error creating manual booking:', error);
    sendErrorResponse(res, 500, 'Internal Server Error');
  }
};

export const markPaymentAsPaid = async (req: User, res: Response): Promise<void> => {
  try {
    const { paymentId } = req.params;
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

    // Perbarui status pembayaran menjadi PAID
    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(paymentId) },
      data: { status: PaymentStatus.PAID }
    });

    // Emit WebSocket event untuk perubahan status pembayaran
    emitBookingEvents('update-payment', {
      booking: payment.booking,
      userId: payment.booking.userId,
      branchId: payment.booking.field.branchId,
      paymentStatus: PaymentStatus.PAID,
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
      message: 'Pembayaran berhasil dilunasi',
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
    const { status } = req.body;

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

    // Perbarui status pembayaran
    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(paymentId) },
      data: { status }
    });

    // Emit WebSocket event untuk perubahan status pembayaran
    emitBookingEvents('update-payment', {
      booking: payment.booking,
      userId: payment.booking.userId,
      branchId: payment.booking.field.branchId,
      paymentStatus: status,
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
      message: 'Status pembayaran berhasil diperbarui',
      data: updatedPayment
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    sendErrorResponse(res, 500, 'Terjadi kesalahan saat memperbarui status pembayaran');
  }
};
