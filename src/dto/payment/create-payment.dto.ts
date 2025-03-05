import { IsNotEmpty, IsEnum, IsNumber } from 'class-validator';

// src/dto/payment/create-payment.dto.ts
export class CreatePaymentDto {
  @IsNotEmpty()
  @IsNumber()
  bookingId!: number;

  @IsNotEmpty()
  @IsNumber()
  userId!: number;

  @IsNotEmpty()
  amount!: number;

  @IsNotEmpty()
  @IsEnum(['midtrans', 'cash', 'transfer', 'credit_card', 'ewallet'])
  paymentMethod!: 'midtrans' | 'cash' | 'transfer' | 'credit_card' | 'ewallet';
}