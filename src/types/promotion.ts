import { Decimal } from '@prisma/client/runtime/library';
import { PromotionStatus } from './enums';
import { User } from './user';
import { Booking } from './booking';

export type Promotion = {
  id: number;
  code: string;
  description: string | null;
  discountPercent: Decimal;
  maxDiscount: Decimal | null;
  validFrom: Date;
  validUntil: Date;
  status: PromotionStatus;
  createdAt: Date;

  // Relations
  PromoUsages?: PromotionUsage[];
};

export type PromotionUsage = {
  id: number;
  userId: number;
  bookingId: number;
  promoId: number;
  createdAt: Date;

  // Relations
  user?: User;
  booking?: Booking;
  promo?: Promotion;
};
