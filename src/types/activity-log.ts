import { User } from './user';

export type ActivityLog = {
  id: number;
  userId: number;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: Date;

  // Relations
  user?: User;
};
