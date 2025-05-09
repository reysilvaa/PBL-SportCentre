import { BranchStatus } from './enums';
import { User } from './user';
import { Field } from './field';

export type Branch = {
  id: number;
  name: string;
  location: string;
  imageUrl: string | null;
  ownerId: number;
  status: BranchStatus;
  createdAt: Date;

  // Relations
  owner?: User;
  admins?: BranchAdmin[];
  Fields?: Field[];
};

export type BranchAdmin = {
  branchId: number;
  userId: number;

  // Relations
  branch?: Branch;
  user?: User;
};
