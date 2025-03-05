import { IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

// src/dto/review/create-review.dto.ts
export class CreateReviewDto {
  @IsNotEmpty()
  @IsNumber()
  userId!: number;

  @IsNotEmpty()
  @IsNumber()
  fieldId!: number;

  @IsNotEmpty()
  @IsNumber()
  rating!: number;

  @IsOptional()
  review?: string;
}