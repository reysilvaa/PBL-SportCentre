import { Decimal } from '@prisma/client/runtime/library';
import { FieldStatus } from './enums';
import { Branch } from './branch';
import { Booking } from './booking';
import { FieldReview } from './review';

export type FieldType = {
  id: number;
  name: string;

  // Relations
  Fields?: Field[];
};

export type Field = {
  id: number;
  branchId: number;
  typeId: number;
  name: string;
  priceDay: Decimal;
  priceNight: Decimal;
  status: FieldStatus;
  imageUrl: string | null;
  createdAt: Date;

  // Relations
  branch?: Branch;
  type?: FieldType;
  Bookings?: Booking[];
  Reviews?: FieldReview[];
};
