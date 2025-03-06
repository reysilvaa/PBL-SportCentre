// import { Server, Socket } from 'socket.io';
// import prisma from '../../config/database';
// import { PaymentStatus, BookingStatus, PaymentMethod } from '@prisma/client';
// import { validate } from 'class-validator';
// import { CreateBookingDto } from '../../dto/booking/create-booking.dto';
// import { isFieldAvailable } from '../../utils/availability.utils';
// import { calculateTotalPrice } from '../../utils/date.utils';
// import midtrans from '../../config/midtrans';

// export const initBookingSocket = (io: Server) => {
//   const bookingNamespace = io.of('/booking');
//   const connectedClients = new Map<string, { userId?: number, role?: string }>();

//   // Middleware for authentication
//   bookingNamespace.use((socket, next) => {
//     const userId = socket.handshake.auth.userId;
//     const role = socket.handshake.auth.role;
    
//     if (userId) {
//       connectedClients.set(socket.id, { userId, role });
//     }
    
//     next();
//   });

//   bookingNamespace.on('connection', (socket: Socket) => {
//     console.log(`Client connected to booking namespace: ${socket.id}`);
    
//     // Send initial data to newly connected client
//     const sendInitialData = async () => {
//       try {
//         const clientInfo = connectedClients.get(socket.id);
//         const filter = clientInfo?.role === 'admin' ? {} : 
//                       (clientInfo?.userId ? { userId: clientInfo.userId } : {});
        
//         const activeBookings = await prisma.booking.findMany({
//           where: {
//             ...filter,
//             status: { notIn: ['canceled', 'refunded'] }
//           },
//           include: {
//             field: { include: { branch: true } },
//             user: { select: { id: true, name: true, email: true } },
//             Payments: true
//           },
//           orderBy: { createdAt: 'desc' },
//           take: 10
//         });
        
//         socket.emit('initialBookings', activeBookings);
//       } catch (error) {
//         console.error('Error fetching initial bookings:', error);
//         socket.emit('error', { 
//           type: 'initial', 
//           error: 'Failed to load initial bookings' 
//         });
//       }
//     };
    
//     sendInitialData();

//     // Handle checking field availability
//     socket.on('checkAvailability', async (data: { fieldId: number, bookingDate: string, startTime: string, endTime: string }) => {
//       try {
//         const { fieldId, bookingDate, startTime, endTime } = data;
        
//         if (!fieldId || !bookingDate || !startTime || !endTime) {
//           return socket.emit('error', { 
//             type: 'validation', 
//             error: 'Missing required fields for availability check' 
//           });
//         }

//         const field = await prisma.field.findUnique({
//           where: { id: fieldId },
//           include: { branch: true }
//         });

//         if (!field) {
//           return socket.emit('error', { 
//             type: 'notFound', 
//             error: 'Field not found' 
//           });
//         }

//         if (field.status !== 'available') {
//           return socket.emit('error', { 
//             type: 'unavailable', 
//             error: 'Field is not available for booking' 
//           });
//         }

//         const bookingDateTime = new Date(bookingDate);
//         const startDateTime = new Date(startTime);
//         const endDateTime = new Date(endTime);

//         if (startDateTime >= endDateTime) {
//           return socket.emit('error', { 
//             type: 'validation', 
//             error: 'End time must be after start time' 
//           });
//         }

//         const isAvailable = await isFieldAvailable(
//           fieldId,
//           bookingDateTime,
//           startDateTime,
//           endDateTime
//         );

//         let pricing = null;
//         if (isAvailable) {
//           const totalPrice = calculateTotalPrice(
//             startDateTime,
//             endDateTime,
//             Number(field.priceDay),
//             Number(field.priceNight)
//           );
          
//           pricing = {
//             totalPrice,
//             priceDay: field.priceDay,
//             priceNight: field.priceNight
//           };
//         }
        
//         socket.emit('availabilityResult', { 
//           isAvailable,
//           field: {
//             id: field.id,
//             name: field.name,
//             branch: field.branch.name
//           },
//           pricing
//         });
//       } catch (error) {
//         console.error('Availability check error:', error);
//         socket.emit('error', {
//           type: 'availability',
//           error: 'Failed to check field availability'
//         });
//       }
//     });

//     // Handle creating a new booking
//     socket.on('createBooking', async (data: CreateBookingDto) => {
//       try {
//         const dto = new CreateBookingDto();
//         Object.assign(dto, data);

//         const errors = await validate(dto);
//         if (errors.length > 0) {
//           return socket.emit('error', { 
//             type: 'validation', 
//             error: 'Validation failed', 
//             details: errors 
//           });
//         }

//         const { userId, fieldId, bookingDate, startTime, endTime, paymentMethod = 'midtrans' } = dto;
        
//         // Get field and user info
//         const field = await prisma.field.findUnique({
//           where: { id: fieldId },
//           include: { branch: true }
//         });

//         if (!field) {
//           return socket.emit('error', { 
//             type: 'notFound', 
//             error: 'Field not found' 
//           });
//         }

//         const user = await prisma.user.findUnique({
//           where: { id: userId },
//           select: { id: true, name: true, email: true }
//         });

//         if (!user) {
//           return socket.emit('error', { 
//             type: 'notFound', 
//             error: 'User not found' 
//           });
//         }

//         const bookingDateTime = new Date(bookingDate);
//         const startDateTime = new Date(startTime);
//         const endDateTime = new Date(endTime);

//         // Check availability
//         const isAvailable = await isFieldAvailable(
//           fieldId, 
//           bookingDateTime, 
//           startDateTime, 
//           endDateTime
//         );

//         if (!isAvailable) {
//           return socket.emit('error', { 
//             type: 'conflict', 
//             error: 'Field is already booked for the requested time slot' 
//           });
//         }

//         // Calculate total price
//         const totalPrice = calculateTotalPrice(
//           startDateTime,
//           endDateTime,
//           Number(field.priceDay),
//           Number(field.priceNight)
//         );

//         // Create booking with transaction
//         const newBooking = await prisma.$transaction(async (prismaClient) => {
//           // Create the booking
//           const booking = await prismaClient.booking.create({
//             data: { 
//               userId, 
//               fieldId, 
//               bookingDate: bookingDateTime, 
//               startTime: startDateTime, 
//               endTime: endDateTime, 
//               status: 'pending', 
//               paymentStatus: 'pending'
//             },
//             include: { 
//               field: { include: { branch: true } }, 
//               user: { select: { name: true, email: true } } 
//             }
//           });

//           // Create a payment record
//           const payment = await prismaClient.payment.create({
//             data: {
//               bookingId: booking.id,
//               userId,
//               amount: totalPrice,
//               paymentMethod: paymentMethod as PaymentMethod,
//               status: 'pending'
//             }
//           });

//           return { ...booking, payment };
//         });

//         // Create Midtrans transaction if payment method is midtrans
//         let paymentRedirect = null;
//         if (paymentMethod === 'midtrans') {
//           const transaction = await midtrans.createTransaction({
//             transaction_details: {
//               order_id: newBooking.payment.id.toString(),
//               gross_amount: Number(totalPrice)
//             },
//             customer_details: {
//               first_name: user.name,
//               email: user.email
//             },
//             item_details: [
//               {
//                 id: field.id.toString(),
//                 name: `${field.branch.name} - ${field.name}`,
//                 price: Number(totalPrice),
//                 quantity: 1
//               }
//             ]
//           });
          
//           paymentRedirect = { 
//             bookingId: newBooking.id,
//             redirectUrl: transaction.redirect_url 
//           };
//         }

//         // Emit events
//         bookingNamespace.emit('newBooking', newBooking);
//         socket.emit('bookingCreated', newBooking);
        
//         if (paymentRedirect) {
//           socket.emit('paymentRedirect', paymentRedirect);
//         }
//       } catch (error) {
//         console.error('Booking creation error:', error);
//         socket.emit('error', { 
//           type: 'creation', 
//           error: 'Failed to create booking'
//         });
//       }
//     });

//     // Handle updating payment status
//     socket.on('updatePayment', async (data: { paymentId: number, status: PaymentStatus }) => {
//       try {
//         const { paymentId, status } = data;
        
//         if (!paymentId || !status) {
//           return socket.emit('error', { 
//             type: 'validation', 
//             error: 'Payment ID and status are required' 
//           });
//         }

//         const payment = await prisma.payment.findUnique({
//           where: { id: paymentId },
//           include: { booking: true }
//         });

//         if (!payment) {
//           return socket.emit('error', { 
//             type: 'notFound', 
//             error: 'Payment not found' 
//           });
//         }

//         // Determine booking status based on payment status
//         let bookingStatus: BookingStatus = payment.booking.status as BookingStatus;
        
//         if (status === 'paid') {
//           bookingStatus = 'confirmed';
//         } else if (status === 'dp_paid') {
//           bookingStatus = 'confirmed';
//         } else if (status === 'failed') {
//           bookingStatus = 'canceled';
//         } else if (status === 'refunded') {
//           bookingStatus = 'refunded';
//         }

//         // Update with transaction
//         const updatedData = await prisma.$transaction(async (prismaClient) => {
//           // Update payment
//           const updatedPayment = await prismaClient.payment.update({
//             where: { id: paymentId },
//             data: { status },
//             include: { booking: { include: { field: true } } }
//           });
          
//           // Update booking status
//           const updatedBooking = await prismaClient.booking.update({
//             where: { id: payment.booking.id },
//             data: { 
//               status: bookingStatus,
//               paymentStatus: status
//             },
//             include: {
//               field: { include: { branch: true } },
//               user: { select: { id: true, name: true, email: true } },
//               Payments: true
//             }
//           });
          
//           return { payment: updatedPayment, booking: updatedBooking };
//         });
        
//         // Notify all clients about the updates
//         bookingNamespace.emit('paymentUpdated', updatedData.payment);
//         bookingNamespace.emit('bookingUpdated', updatedData.booking);
        
//         socket.emit('paymentUpdateConfirmed', updatedData);
//       } catch (error) {
//         console.error('Payment update error:', error);
//         socket.emit('error', { 
//           type: 'payment', 
//           error: 'Failed to update payment status'
//         });
//       }
//     });

//     // Handler for Midtrans webhook simulation (for testing)
//     socket.on('simulatePaymentWebhook', async (data: { 
//       order_id: string, 
//       transaction_status: string,
//       gross_amount: string
//     }) => {
//       try {
//         const { order_id, transaction_status, gross_amount } = data;
//         const paymentId = Number(order_id);
        
//         if (!paymentId) {
//           return socket.emit('error', { 
//             type: 'validation', 
//             error: 'Invalid payment ID' 
//           });
//         }

//         // Get payment with related booking
//         const payment = await prisma.payment.findUnique({
//           where: { id: paymentId },
//           include: {
//             booking: {
//               include: {
//                 field: true
//               }
//             }
//           },
//         });

//         if (!payment) {
//           return socket.emit('error', { 
//             type: 'notFound', 
//             error: 'Payment not found' 
//           });
//         }

//         let paymentStatus: PaymentStatus = 'pending';
//         let bookingStatus: BookingStatus = payment.booking.status as BookingStatus;

//         // Determine payment and booking status based on transaction status
//         if (transaction_status === 'capture' || transaction_status === 'settlement') {
//           // Check if it's a DP payment or full payment
//           const fieldPrice = payment.booking.field.priceNight;
//           const paymentAmount = Number(gross_amount);
          
//           if (paymentAmount < Number(fieldPrice)) {
//             paymentStatus = 'dp_paid';
//             bookingStatus = 'confirmed';
//           } else {
//             paymentStatus = 'paid';
//             bookingStatus = 'confirmed';
//           }
//         } else if (transaction_status === 'pending') {
//           paymentStatus = 'pending';
//         } else if (['expire', 'cancel', 'deny'].includes(transaction_status)) {
//           paymentStatus = 'failed';
//           bookingStatus = 'canceled';
//         }

//         // Update with transaction
//         const updatedData = await prisma.$transaction(async (prismaClient) => {
//           // Update payment
//           const updatedPayment = await prismaClient.payment.update({
//             where: { id: paymentId },
//             data: { status: paymentStatus },
//             include: { booking: true }
//           });
          
//           // Update booking
//           const updatedBooking = await prismaClient.booking.update({
//             where: { id: payment.booking.id },
//             data: { 
//               status: bookingStatus,
//               paymentStatus
//             },
//             include: {
//               field: { include: { branch: true } },
//               user: { select: { id: true, name: true, email: true } },
//               Payments: true
//             }
//           });
          
//           return { payment: updatedPayment, booking: updatedBooking };
//         });
        
//         // Notify all clients
//         bookingNamespace.emit('paymentUpdated', updatedData.payment);
//         bookingNamespace.emit('bookingUpdated', updatedData.booking);
        
//         socket.emit('webhookProcessed', {
//           success: true,
//           payment: updatedData.payment,
//           booking: updatedData.booking
//         });
//       } catch (error) {
//         console.error('Webhook simulation error:', error);
//         socket.emit('error', { 
//           type: 'webhook', 
//           error: 'Failed to process payment webhook'
//         });
//       }
//     });

//     // Handle canceling a booking
//     socket.on('cancelBooking', async (data: { bookingId: number, userId: number, reason?: string }) => {
//       try {
//         const { bookingId, userId, reason } = data;
        
//         if (!bookingId || !userId) {
//           return socket.emit('error', { 
//             type: 'validation', 
//             error: 'Booking ID and User ID are required' 
//           });
//         }

//         // Check if booking exists and belongs to user
//         const booking = await prisma.booking.findFirst({
//           where: { 
//             id: bookingId,
//             userId 
//           },
//           include: {
//             Payments: true
//           }
//         });

//         if (!booking) {
//           return socket.emit('error', { 
//             type: 'notFound', 
//             error: 'Booking not found or you do not have permission to cancel it' 
//           });
//         }

//         // Add logic to check if booking can be canceled (e.g., time constraints)
//         const now = new Date();
//         const bookingStartTime = new Date(booking.startTime);
//         const hoursUntilBooking = (bookingStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        
//         if (hoursUntilBooking < 2) {
//           return socket.emit('error', { 
//             type: 'timeConstraint', 
//             error: 'Bookings cannot be canceled less than 2 hours before start time' 
//           });
//         }

//         // Cancel with transaction (cancel booking and update payment)
//         const cancelledData = await prisma.$transaction(async (prismaClient) => {
//           // Update booking status
//           const updatedBooking = await prismaClient.booking.update({ 
//             where: { id: bookingId }, 
//             data: { 
//               status: 'canceled',
//               paymentStatus: 'failed'
//             },
//             include: {
//               field: { include: { branch: true } },
//               user: { select: { id: true, name: true, email: true } },
//               Payments: true
//             }
//           });

//           // Update all associated payments
//           const updatedPayments = await Promise.all(
//             booking.Payments.map(payment => 
//               prismaClient.payment.update({
//                 where: { id: payment.id },
//                 data: { status: 'failed' }
//               })
//             )
//           );

//           return { booking: updatedBooking, payments: updatedPayments };
//         });
        
//         // Notify all connected clients
//         bookingNamespace.emit('bookingCancelled', cancelledData.booking);
//         cancelledData.payments.forEach(payment => {
//           bookingNamespace.emit('paymentUpdated', payment);
//         });
        
//         socket.emit('cancellationConfirmed', cancelledData);
//       } catch (error) {
//         console.error('Booking cancellation error:', error);
//         socket.emit('error', { 
//           type: 'cancellation', 
//           error: 'Failed to cancel booking'
//         });
//       }
//     });

//     // Handle booking completion
//     socket.on('completeBooking', async (data: { bookingId: number, userId: number }) => {
//       try {
//         const { bookingId, userId } = data;
        
//         if (!bookingId) {
//           return socket.emit('error', { 
//             type: 'validation', 
//             error: 'Booking ID is required' 
//           });
//         }

//         // Check if booking exists
//         const booking = await prisma.booking.findFirst({
//           where: { id: bookingId },
//           include: { Payments: true }
//         });

//         if (!booking) {
//           return socket.emit('error', { 
//             type: 'notFound', 
//             error: 'Booking not found' 
//           });
//         }

//         // Only admins or the booking owner can complete a booking
//         const clientInfo = connectedClients.get(socket.id);
//         if (clientInfo?.role !== 'admin' && booking.userId !== userId) {
//           return socket.emit('error', { 
//             type: 'unauthorized', 
//             error: 'You do not have permission to complete this booking' 
//           });
//         }

//         // Complete booking
//         const completedBooking = await prisma.booking.update({
//           where: { id: bookingId },
//           data: { status: 'completed' },
//           include: {
//             field: { include: { branch: true } },
//             user: { select: { id: true, name: true, email: true } },
//             Payments: true
//           }
//         });
        
//         // Notify all connected clients
//         bookingNamespace.emit('bookingCompleted', completedBooking);
//         socket.emit('completionConfirmed', completedBooking);
//       } catch (error) {
//         console.error('Booking completion error:', error);
//         socket.emit('error', { 
//           type: 'completion', 
//           error: 'Failed to complete booking'
//         });
//       }
//     });

//     // Handle real-time field monitoring
//     socket.on('monitorField', async (fieldId: number) => {
//       socket.join(`field:${fieldId}`);
//     });

//     socket.on('stopMonitoring', async (fieldId: number) => {
//       socket.leave(`field:${fieldId}`);
//     });

//     // Handle disconnection
//     socket.on('disconnect', () => {
//       console.log(`Client disconnected from booking namespace: ${socket.id}`);
//       connectedClients.delete(socket.id);
//     });
//   });

//   // Function to notify clients about field status changes
//   const notifyFieldStatusChange = (fieldId: number, status: string) => {
//     bookingNamespace.to(`field:${fieldId}`).emit('fieldStatusChanged', {
//       fieldId,
//       status,
//       timestamp: new Date()
//     });
//   };

//   // Function to broadcast payment status updates (used by webhook handler)
//   const notifyPaymentUpdate = async (paymentId: number, transactionStatus: string, amount: string | number) => {
//     try {
//       const paymentIdNum = Number(paymentId);
//       const payment = await prisma.payment.findUnique({
//         where: { id: paymentIdNum },
//         include: { booking: true }
//       });

//       if (!payment) {
//         console.error(`Payment ${paymentId} not found`);
//         return false;
//       }

//       let paymentStatus: PaymentStatus = 'pending';
//       let bookingStatus: BookingStatus = payment.booking.status as BookingStatus;

//       // Determine statuses based on transaction status
//       if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
//         // Compare amount to determine if it's a full or partial payment
//         const totalBookingAmount = Number(payment.amount);
//         const paidAmount = Number(amount);
        
//         if (paidAmount >= totalBookingAmount * 0.9) { // Allow small discrepancies
//           paymentStatus = 'paid';
//           bookingStatus = 'confirmed';
//         } else {
//           paymentStatus = 'dp_paid';
//           bookingStatus = 'confirmed';
//         }
//       } else if (transactionStatus === 'pending') {
//         paymentStatus = 'pending';
//       } else if (['expire', 'cancel', 'deny'].includes(transactionStatus)) {
//         paymentStatus = 'failed';
//         bookingStatus = 'canceled';
//       }

//       // Update with transaction
//       const updatedData = await prisma.$transaction(async (prismaClient) => {
//         // Update payment
//         const updatedPayment = await prismaClient.payment.update({
//           where: { id: paymentIdNum },
//           data: { status: paymentStatus },
//           include: { booking: true }
//         });
        
//         // Update booking
//         const updatedBooking = await prismaClient.booking.update({
//           where: { id: payment.booking.id },
//           data: { 
//             status: bookingStatus,
//             paymentStatus
//           },
//           include: {
//             field: { include: { branch: true } },
//             user: { select: { id: true, name: true, email: true } }
//           }
//         });
        
//         return { payment: updatedPayment, booking: updatedBooking };
//       });
      
//       // Broadcast updates
//       bookingNamespace.emit('paymentUpdated', updatedData.payment);
//       bookingNamespace.emit('bookingUpdated', updatedData.booking);
      
//       return true;
//     } catch (error) {
//       console.error('Payment notification error:', error);
//       return false;
//     }
//   };

//   return {
//     notifyFieldStatusChange,
//     notifyPaymentUpdate
//   };
// };