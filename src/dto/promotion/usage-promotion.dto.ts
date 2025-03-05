import { IsNotEmpty, IsNumber } from 'class-validator';

export class PromotionUsageDto {
    @IsNotEmpty()
    @IsNumber()
    userId!: number;
  
    @IsNotEmpty()
    @IsNumber()
    bookingId!: number;
  
    @IsNotEmpty()
    @IsNumber()
    promoId!: number;
  }