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

export enum BookingStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  DP_PAID = 'dp_paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  // E-Wallet via Midtrans
  GOPAY = 'gopay',
  SHOPEEPAY = 'shopeepay',
  QRIS = 'qris',
  
  // Bank transfer via Midtrans
  BCA_VA = 'bca_va',
  BRI_VA = 'bri_va', 
  BNI_VA = 'bni_va',
  PERMATA_VA = 'permata_va',
  MANDIRI_BILL = 'mandiri_bill',
  MANDIRI_VA = 'mandiri_va',
  CIMB_VA = 'cimb_va',
  DANAMON_VA = 'danamon_va',
  
  // Gerai Retail via Midtrans
  INDOMARET = 'indomaret',
  ALFAMART = 'alfamart',

  // Paylater via Midtrans
  AKULAKU = 'akulaku',
  KREDIVO = 'kredivo',
  
  // E-Wallet lainnya
  DANA = 'dana',
  
  // Kartu kredit/debit via Midtrans
  CREDIT_CARD = 'credit_card',
  
  // Opsi pembayaran tunai di tempat (tidak melalui Midtrans)
  CASH = 'cash',
  
  // International Payment
  PAYPAL = 'paypal',
  GOOGLE_PAY = 'google_pay',
}

export enum PromotionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DISABLED = 'disabled',
}
