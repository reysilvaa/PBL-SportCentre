import { IsNotEmpty, IsOptional, IsDate } from 'class-validator';

// src/dto/promotion/create-promotion.dto.ts
export class CreatePromotionDto {
    @IsNotEmpty()
    code!: string;
  
    @IsOptional()
    description?: string;
  
    @IsNotEmpty()
    discountPercent!: number;
  
    @IsOptional()
    maxDiscount?: number;
  
    @IsNotEmpty()
    @IsDate()
    validFrom!: Date;
  
    @IsNotEmpty()
    @IsDate()
    validUntil!: Date;
  }