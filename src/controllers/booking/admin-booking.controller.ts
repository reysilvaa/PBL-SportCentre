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
    let whereCondition: any = { field: { branchId } };

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

    // Get all bookings for fields in this branch
    const bookings = await prisma.booking.findMany({
      where: whereCondition,
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

    res.status(200).json(filteredBookings);
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
        field: { include: { branch: true } },
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

    const bookingDateTime = new Date(bookingDate);
    console.log('📆 Booking Date:', bookingDateTime);

    const startDateTime = combineDateWithTime(bookingDateTime, startTime);
    const endDateTime = combineDateWithTime(bookingDateTime, endTime);

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
