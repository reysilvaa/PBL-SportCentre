// Socket Handlers Index
import * as ActivityLogSocket from './activityLog.socket';
import * as BranchSocket from './branch.socket';
import * as FieldSocket from './field.socket';
import * as PaymentSocket from './payment.socket';
import * as BookingSocket from './booking.socket';

/**
 * Initialize all socket handlers
 */
export const initializeAllSocketHandlers = (): void => {
  console.log('🔌 Initializing all socket handlers...');

  // Initialize all socket handlers
  BranchSocket.setupBranchSocketHandlers();
  FieldSocket.setupFieldSocketHandlers();
  PaymentSocket.setupPaymentSocketHandlers();
  ActivityLogSocket.setupActivityLogSocketHandlers();

  console.log('✅ All socket handlers initialized successfully');
};

// Re-export socket handlers
export { 
  ActivityLogSocket,
  BranchSocket, 
  FieldSocket,
  PaymentSocket,
  BookingSocket
};

export default initializeAllSocketHandlers;
