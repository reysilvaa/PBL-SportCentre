import { User } from './user';

export type Notification = {
  id: number;
  userId: number;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  linkId: string | null;
  createdAt: Date;

  // Relations
  user?: User;
};
