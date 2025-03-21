import { setupBranchSocketHandlers } from './branch.socket';
import { setupFieldSocketHandlers } from './field.socket';
import { setupPaymentSocketHandlers } from './payment.socket';
import { setupActivityLogSocketHandlers } from './activityLog.socket';

/**
 * Initialize all socket handlers
 */
export const initializeAllSocketHandlers = (): void => {
  console.log('🔌 Initializing all socket handlers...');
  
  // Initialize all socket handlers
  setupBranchSocketHandlers();
  setupFieldSocketHandlers();
  setupPaymentSocketHandlers();
  setupActivityLogSocketHandlers();
  
  console.log('✅ All socket handlers initialized successfully');
}; 