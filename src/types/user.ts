import { Role } from './enums';
import { Booking } from './booking';
import { Payment } from './payment';
import { ActivityLog } from './activity-log';
import { FieldReview } from './review';
import { PromotionUsage } from './promotion';
import { Branch, BranchAdmin } from './branch';
import { Notification } from './notification';

export type User = {
  id: number;
  name: string;
  email: string;
  password: string;
  phone: string | null;
  role: Role;
  createdAt: Date;

  // Relations
  Bookings?: Booking[];
  Payments?: Payment[];
  ActivityLogs?: ActivityLog[];
  Reviews?: FieldReview[];
  PromoUsages?: PromotionUsage[];
  ownedBranches?: Branch[];
  notifications?: Notification[];
  branches?: BranchAdmin[];
};
