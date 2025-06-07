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
  // Opsi pembayaran tunai di tempat (tidak melalui Midtrans)
  CASH = 'cash',
  
  // Kartu kredit/debit via Midtrans
  CREDIT_CARD = 'credit_card',
  
  // Bank transfer via Midtrans
  BCA_VA = 'bca_va',
  BNI_VA = 'bni_va', 
  BRI_VA = 'bri_va',
  MANDIRI_VA = 'mandiri_va',
  PERMATA_VA = 'permata_va',
  CIMB_VA = 'cimb_va',
  DANAMON_VA = 'danamon_va',
  
  // E-Wallet via Midtrans
  GOPAY = 'gopay',
  SHOPEEPAY = 'shopeepay',
  QRIS = 'qris',
  DANA = 'dana',
  
  // Gerai Retail via Midtrans
  INDOMARET = 'indomaret',
  ALFAMART = 'alfamart',

  // Paylater via Midtrans
  AKULAKU = 'akulaku',
  KREDIVO = 'kredivo',
  
  // International Payment
  PAYPAL = 'paypal',
  GOOGLE_PAY = 'google_pay',
}

export enum PromotionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DISABLED = 'disabled',
}
