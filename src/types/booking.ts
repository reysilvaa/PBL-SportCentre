import { User } from './user';
import { Field } from './field';
import { Payment } from './payment';
import { PromotionUsage } from './promotion';

// Type untuk waktu booking
export type BookingTime = Date;

export type Booking = {
  id: number;
  userId: number;
  fieldId: number;
  bookingDate: Date;
  startTime: Date;
  endTime: Date;
  createdAt: Date;

  // Relations
  user?: User;
  field?: Field;
  payment?: Payment;
  PromoUsages?: PromotionUsage[];
};
