import { User } from './user';
import { Field } from './field';

export type FieldReview = {
  id: number;
  userId: number;
  fieldId: number;
  rating: number;
  review: string | null;
  createdAt: Date;
  
  // Relations
  user?: User;
  field?: Field;
}; 