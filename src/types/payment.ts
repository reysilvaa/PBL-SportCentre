import { Decimal } from "@prisma/client/runtime/library";
import { PaymentMethod, PaymentStatus } from './enums';
import { Booking } from './booking';
import { User } from './user';

export type Payment = {
  id: number;
  bookingId: number;
  userId: number;
  amount: Decimal;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  createdAt: Date;
  expiresDate: Date | null;
  transactionId: string | null;
  paymentUrl: string | null;
  
  // Relations
  booking?: Booking;
  user?: User;
}; 