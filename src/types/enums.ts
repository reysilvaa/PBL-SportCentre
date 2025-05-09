// Enum Types
export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN_CABANG = 'admin_cabang',
  OWNER_CABANG = 'owner_cabang',
  USER = 'user',
}

export enum BranchStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum FieldStatus {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  MAINTENANCE = 'maintenance',
  CLOSED = 'closed',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  DP_PAID = 'dp_paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  MIDTRANS = 'midtrans',
  CASH = 'cash',
  TRANSFER = 'transfer',
  CREDIT_CARD = 'credit_card',
  E_WALLET = 'ewallet',
}

export enum PromotionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DISABLED = 'disabled',
}
