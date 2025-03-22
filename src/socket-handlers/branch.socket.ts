import { Socket } from 'socket.io';
import prisma from '../config/database';
import { getIO } from '../config/socket';
import {
  validateBookingTime,
  verifyFieldBranch,
  createBookingWithPayment,
  getCompleteBooking,
  emitBookingEvents,
} from '../utils/booking/booking.utils';

/**
 * Handle booking search request
 */
export const handleBookingSearch = async (socket: Socket, data: any) => {
  try {
    // Periksa autentikasi
    if (!socket.data.authenticated || !socket.data.user) {
      socket.emit('auth:required', {
        message: 'Authentication required for this operation',
      });
      return;
    }

    const { query, branchId } = data;

    // Search bookings by user name, email, or booking ID
    const bookings = await prisma.booking.findMany({
      where: {
        field: {
          branchId: parseInt(branchId),
        },
        OR: [
          { id: isNaN(parseInt(query)) ? undefined : parseInt(query) },
          { user: { name: { contains: query } } },
          { user: { email: { contains: query } } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        field: true,
        payment: true,
      },
      take: 20,
    });

    // Send results back to the client
    socket.emit('booking:search-results', bookings);
  } catch (error) {
    console.error('Search error:', error);
    socket.emit('booking:search-error', {
      message: 'Failed to search bookings',
    });
  }
};

/**
 * Handle field availability check
 */
export const handleFieldAvailabilityCheck = async (
  socket: Socket,
  data: any,
) => {
  try {
    const { fieldId, bookingDate, startTime, endTime } = data;

    // Convert to proper date objects
    const bookingDateTime = new Date(bookingDate);
    bookingDateTime.setHours(0, 0, 0, 0);

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    // Validate booking time and availability
    const timeValidation = await validateBookingTime(
      parseInt(fieldId.toString()),
      bookingDateTime,
      startDateTime,
      endDateTime,
    );

    if (!timeValidation.valid) {
      socket.emit('field:availability-error', {
        message: timeValidation.message,
        details: timeValidation.details,
      });
      return;
    }

    // Send availability result back to client
    socket.emit('field:availability-result', {
      fieldId,
      bookingDate: bookingDateTime.toISOString(),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      isAvailable: true,
    });
  } catch (error) {
    console.error('Availability check error:', error);
    socket.emit('field:availability-error', {
      message: 'Failed to check field availability',
      error: error,
    });
  }
};

/**
 * Handle booking statistics request
 */
export const handleBookingStats = async (socket: Socket, data: any) => {
  try {
    // Periksa autentikasi
    if (!socket.data.authenticated || !socket.data.user) {
      socket.emit('auth:required', {
        message: 'Authentication required for this operation',
      });
      return;
    }

    const { branchId } = data;

    // Get today's date at 00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get booking statistics
    const todayBookings = await prisma.booking.count({
      where: {
        field: { branchId: parseInt(branchId) },
        bookingDate: { gte: today },
      },
    });

    const pendingPayments = await prisma.booking.count({
      where: {
        field: { branchId: parseInt(branchId) },
        payment: { status: 'pending' },
      },
    });

    // Send stats back to the client
    socket.emit('booking:stats-results', {
      todayBookings,
      pendingPayments,
    });
  } catch (error) {
    console.error('Stats error:', error);
    socket.emit('booking:stats-error', {
      message: 'Failed to fetch booking statistics',
    });
  }
};

/**
 * Handle manual booking creation
 */
export const handleCreateManualBooking = async (socket: Socket, data: any) => {
  try {
    // Periksa autentikasi
    if (!socket.data.authenticated || !socket.data.user) {
      socket.emit('auth:required', {
        message: 'Authentication required for this operation',
      });
      return;
    }

    const {
      fieldId,
      userId,
      bookingDate,
      startTime,
      endTime,
      paymentStatus,
      branchId,
    } = data;

    // Verify the field belongs to this branch
    const field = await verifyFieldBranch(
      parseInt(fieldId.toString()),
      parseInt(branchId),
    );

    if (!field) {
      socket.emit('booking:create-error', {
        message: 'Field not found in this branch',
      });
      return;
    }

    // Convert to proper date objects
    const bookingDateTime = new Date(bookingDate);
    bookingDateTime.setHours(0, 0, 0, 0);

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    // Validate booking time and availability
    const timeValidation = await validateBookingTime(
      parseInt(fieldId.toString()),
      bookingDateTime,
      startDateTime,
      endDateTime,
    );

    if (!timeValidation.valid) {
      socket.emit('booking:create-error', {
        message: timeValidation.message,
        details: timeValidation.details,
      });
      return;
    }

    // Create booking and payment records
    const { booking, payment } = await createBookingWithPayment(
      parseInt(userId.toString()),
      parseInt(fieldId.toString()),
      bookingDateTime,
      startDateTime,
      endDateTime,
      paymentStatus || 'paid',
      'cash',
      field.priceDay,
    );

    // Get complete booking with relations
    const completeBooking = await getCompleteBooking(booking.id);

    // Emit to current client
    socket.emit('booking:create-success', completeBooking);

    // Emit WebSocket events
    emitBookingEvents('new-booking', {
      booking: completeBooking,
      userId: parseInt(userId.toString()),
      fieldId: parseInt(fieldId.toString()),
      branchId: parseInt(branchId),
      bookingDate: bookingDateTime,
      startTime: startDateTime,
      endTime: endDateTime,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    socket.emit('booking:create-error', {
      message: 'Failed to create manual booking',
      error: error,
    });
  }
};

/**
 * Handle authentication
 */
export const handleAuthentication = async (
  socket: Socket,
  data: any,
  callback: Function,
) => {
  try {
    const { token } = data;
    if (!token) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Token is required' });
      }
      return;
    }

    // Import auth middleware dynamically to avoid circular dependencies
    const { authMiddleware } = require('../middlewares/auth.middleware');

    const user = await authMiddleware(token);
    if (!user) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Invalid token' });
      }
      return;
    }

    // Update socket data
    socket.data.user = user;
    socket.data.authenticated = true;

    // Join branch-specific room jika user memiliki branchId
    const branchId = user.branchId;
    if (branchId) {
      socket.join(`branch-${branchId}`);
      console.log(`Admin joined branch-${branchId} room after auth`);
    }

    if (typeof callback === 'function') {
      callback({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
        },
      });
    }
  } catch (error) {
    console.error('Auth error:', error);
    if (typeof callback === 'function') {
      callback({ success: false, error: 'Authentication failed' });
    }
  }
};

/**
 * Setup WebSocket handlers for branch bookings
 */
export const setupBranchSocketHandlers = (): void => {
  const io = getIO();
  const branchNamespace = io.of('/branches');

  // Middleware untuk autentikasi yang lebih fleksibel
  branchNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      // Jika tidak ada token, izinkan koneksi tapi tandai sebagai tidak terautentikasi
      if (!token) {
        console.log(`Branch client connected without auth token: ${socket.id}`);
        socket.data.user = null;
        socket.data.authenticated = false;
        return next();
      }

      // Verifikasi token
      try {
        // Import auth middleware dynamically to avoid circular dependencies
        const { authMiddleware } = require('../middlewares/auth.middleware');

        const user = await authMiddleware(token);
        if (!user) {
          console.log(
            `Branch client connected with invalid token: ${socket.id}`,
          );
          socket.data.user = null;
          socket.data.authenticated = false;
          return next();
        }

        socket.data.user = user;
        socket.data.authenticated = true;
        console.log(
          `Branch client authenticated: ${socket.id}, User: ${user.id}, Role: ${user.role}`,
        );
        next();
      } catch (authError) {
        console.log(`Branch client auth error: ${socket.id}`, authError);
        socket.data.user = null;
        socket.data.authenticated = false;
        next();
      }
    } catch (error) {
      console.error(`Branch namespace middleware error: ${socket.id}`, error);
      socket.data.user = null;
      socket.data.authenticated = false;
      next();
    }
  });

  branchNamespace.on('connection', (socket) => {
    console.log(`🏢 Branch client connected: ${socket.id}`);

    // Periksa apakah klien terautentikasi
    if (socket.data.authenticated && socket.data.user) {
      // Join branch-specific room jika user memiliki branchId
      const branchId = socket.data.user.branchId;
      if (branchId) {
        socket.join(`branch-${branchId}`);
        console.log(`Admin joined branch-${branchId} room`);
      }
    } else {
      // Kirim pesan ke klien bahwa mereka perlu autentikasi untuk fitur penuh
      socket.emit('auth:required', {
        message: 'Authentication required for full access',
        currentStatus: 'unauthenticated',
      });
    }

    // Register event handlers
    socket.on('auth:login', (data, callback) =>
      handleAuthentication(socket, data, callback),
    );
    socket.on('booking:search', (data) => handleBookingSearch(socket, data));
    socket.on('field:check-availability', (data) =>
      handleFieldAvailabilityCheck(socket, data),
    );
    socket.on('booking:stats', (data) => handleBookingStats(socket, data));
    socket.on('booking:create-manual', (data) =>
      handleCreateManualBooking(socket, data),
    );

    // Handle admin leaving
    socket.on('disconnect', () => {
      console.log(`🏢 Branch client disconnected: ${socket.id}`);
      if (socket.data.user && socket.data.user.branchId) {
        socket.leave(`branch-${socket.data.user.branchId}`);
      }
    });
  });

  console.log('✅ Branch socket handlers initialized');
};
