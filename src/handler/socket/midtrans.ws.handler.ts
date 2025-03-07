import { Namespace } from 'socket.io';
import prisma from '../../config/database';
import { PaymentStatus } from '@prisma/client';

export function setupMidtransHandlers(namespace: Namespace) {
  namespace.on('connection', (socket) => {
    // This function listens for the "payment-update" event
    // which will be triggered by the Midtrans webhook
    socket.on('payment-notification', async (data) => {
      const { order_id, transaction_status, status_code } = data;
      
      // Log the received notification
      console.log('Payment notification received via socket:', {
        order_id,
        transaction_status,
        status_code
      });
      
      // Extract payment ID from order_id (removes the PAY- prefix)
      let paymentId: number | null = null;
      
      if (order_id.startsWith('PAY-')) {
        const idPart = order_id.substring(4).split('-')[0];
        paymentId = parseInt(idPart);
      }
      
      if (!paymentId || isNaN(paymentId)) {
        console.error('Invalid payment ID from order_id:', order_id);
        return;
      }
      
      try {
        // Get the payment and related booking
        const payment = await prisma.payment.findUnique({
          where: { id: paymentId },
          include: {
            booking: true,
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        });
        
        if (!payment) {
          console.error('Payment not found for ID:', paymentId);
          return;
        }
        
        // Update payment status based on transaction status
        let paymentStatus: PaymentStatus = PaymentStatus.pending;
        
        if (transaction_status === 'capture' || transaction_status === 'settlement') {
          paymentStatus = PaymentStatus.paid;
        } else if (transaction_status === 'pending') {
          paymentStatus = PaymentStatus.pending;
        } else if (['expire', 'cancel', 'deny', 'failure'].includes(transaction_status)) {
          paymentStatus = PaymentStatus.failed;
        }
        
        // Update the payment record
        const updatedPayment = await prisma.payment.update({
          where: { id: paymentId },
          data: { status: paymentStatus },
          include: { booking: true }
        });
        
        // Emit events to relevant rooms
        
        // Emit to the user who made the payment
        namespace.to(`user-${payment.userId}`).emit('payment-updated', {
          paymentId: updatedPayment.id,
          bookingId: updatedPayment.bookingId,
          status: updatedPayment.status,
          transactionStatus: transaction_status
        });
        
        // Also emit to the general payments channel for admin dashboard updates
        namespace.emit('payment-status-changed', {
          paymentId: updatedPayment.id,
          bookingId: updatedPayment.bookingId,
          status: updatedPayment.status
        });
        
        console.log(`Payment ${paymentId} status updated to ${paymentStatus}`);
      } catch (error) {
        console.error('Error processing payment notification:', error);
      }
    });
  });
}