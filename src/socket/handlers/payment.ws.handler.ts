import { Namespace } from 'socket.io';
import prisma from '../../config/database';
import midtrans from '../../config/midtrans';

export function setupPaymentHandlers(namespace: Namespace) {
  namespace.on('connection', (socket) => {
    console.log(`User connected to payments namespace: ${socket.data.user.id}`);

    // Join a room specific to the user for targeted updates
    socket.join(`user-${socket.data.user.id}`);

    // Create payment for a booking
    socket.on('create-payment', async (data, callback) => {
      try {
        const { bookingId, amount, paymentMethod = 'midtrans' } = data;
        const userId = socket.data.user.id;
        
        if (!bookingId || !amount) {
          return callback({ 
            status: 'error', 
            message: 'Missing required fields' 
          });
        }
        
        // Check if booking exists
        const booking = await prisma.booking.findUnique({
          where: { id: Number(bookingId) },
          include: { 
            field: { include: { branch: true } },
            user: { select: { name: true, email: true, phone: true } }
          }
        });
        
        if (!booking) {
          return callback({ 
            status: 'error', 
            message: 'Booking not found' 
          });
        }
        
        if (booking.userId !== userId) {
          return callback({ 
            status: 'error', 
            message: 'Not authorized to create payment for this booking' 
          });
        }
        
        // Check if there's already a payment for this booking
        const existingPayment = await prisma.payment.findUnique({
          where: { bookingId: Number(bookingId) }
        });
        
        if (existingPayment) {
          return callback({ 
            status: 'error', 
            message: 'Payment already exists for this booking' 
          });
        }
        
        // Create payment record
        const newPayment = await prisma.payment.create({
          data: { 
            bookingId: Number(bookingId), 
            userId, 
            amount: Number(amount), 
            paymentMethod, 
            status: 'pending' 
          }
        });
        
        // If payment method is Midtrans, create transaction
        if (paymentMethod === 'midtrans') {
          const transaction = await midtrans.createTransaction({
            transaction_details: {
              order_id: `PAY-${newPayment.id}`,
              gross_amount: Number(amount)
            },
            customer_details: {
              first_name: booking.user.name,
              email: booking.user.email,
              phone: booking.user.phone
            },
            item_details: [
              {
                id: booking.field.id.toString(),
                name: `${booking.field.branch.name} - ${booking.field.name}`,
                price: Number(amount),
                quantity: 1
              }
            ],
            callbacks: {
              finish: `${process.env.FRONTEND_URL}/payment/finish?order_id=PAY-${newPayment.id}`,
              error: `${process.env.FRONTEND_URL}/payment/error?order_id=PAY-${newPayment.id}`,
              pending: `${process.env.FRONTEND_URL}/payment/pending?order_id=PAY-${newPayment.id}`
            }
          });
          
          if (!transaction.redirect_url) {
            return callback({ 
              status: 'error', 
              message: 'Failed to initiate payment' 
            });
          }
          
          callback({ 
            status: 'success', 
            data: { 
              payment: newPayment,
              redirectUrl: transaction.redirect_url 
            } 
          });
        } else {
          callback({ 
            status: 'success', 
            data: { payment: newPayment } 
          });
        }
      } catch (error) {
        console.error('Create payment error:', error);
        callback({ 
          status: 'error', 
          message: 'Failed to create payment' 
        });
      }
    });

    // Get payment status
    socket.on('get-payment-status', async (data, callback) => {
      try {
        const { paymentId } = data;
        const userId = socket.data.user.id;
        
        const payment = await prisma.payment.findUnique({
          where: { id: Number(paymentId) },
          include: {
            booking: { 
              include: { 
                field: { include: { branch: true } } 
              } 
            }
          }
        });
        
        if (!payment) {
          return callback({ 
            status: 'error', 
            message: 'Payment not found' 
          });
        }
        
        if (payment.userId !== userId) {
          return callback({ 
            status: 'error', 
            message: 'Not authorized to access this payment' 
          });
        }
        
        callback({ 
          status: 'success', 
          data: { payment } 
        });
      } catch (error) {
        console.error('Get payment status error:', error);
        callback({ 
          status: 'error', 
          message: 'Failed to get payment status' 
        });
      }
    });

    // Retry payment
    socket.on('retry-payment', async (data, callback) => {
      try {
        const { paymentId } = data;
        const userId = socket.data.user.id;
        
        const payment = await prisma.payment.findUnique({
          where: { id: Number(paymentId) },
          include: {
            booking: {
              include: { 
                field: { include: { branch: true } },
                user: { select: { name: true, email: true, phone: true } }
              }
            }
          }
        });
        
        if (!payment) {
          return callback({ 
            status: 'error', 
            message: 'Payment not found' 
          });
        }
        
        if (payment.userId !== userId) {
          return callback({ 
            status: 'error', 
            message: 'Not authorized to retry this payment' 
          });
        }
        
        if (payment.status === 'paid') {
          return callback({ 
            status: 'error', 
            message: 'Payment already completed' 
          });
        }
        
        const retryOrderId = `PAY-${payment.id}-RETRY-${Date.now()}`;
        
        // Create a new Midtrans transaction
        const transaction = await midtrans.createTransaction({
          transaction_details: {
            order_id: retryOrderId,
            gross_amount: payment.amount
          },
          customer_details: {
            first_name: payment.booking.user.name,
            email: payment.booking.user.email,
            phone: payment.booking.user.phone
          },
          item_details: [
            {
              id: payment.booking.field.id.toString(),
              name: `${payment.booking.field.branch.name} - ${payment.booking.field.name}`,
              price: payment.amount,
              quantity: 1
            }
          ],
          callbacks: {
            finish: `${process.env.FRONTEND_URL}/payment/finish?order_id=${retryOrderId}`,
            error: `${process.env.FRONTEND_URL}/payment/error?order_id=${retryOrderId}`,
            pending: `${process.env.FRONTEND_URL}/payment/pending?order_id=${retryOrderId}`
          }
        });
        
        if (!transaction.redirect_url) {
          return callback({ 
            status: 'error', 
            message: 'Failed to initiate payment retry' 
          });
        }
        
        // Update payment status to pending
        await prisma.payment.update({
          where: { id: Number(paymentId) },
          data: { status: 'pending' }
        });
        
        callback({ 
          status: 'success', 
          data: { 
            redirectUrl: transaction.redirect_url 
          } 
        });
      } catch (error) {
        console.error('Retry payment error:', error);
        callback({ 
          status: 'error', 
          message: 'Failed to retry payment' 
        });
      }
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected from payments namespace: ${socket.data.user.id}`);
    });
  });
}