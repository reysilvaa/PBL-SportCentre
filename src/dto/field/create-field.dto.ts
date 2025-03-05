import { IsNotEmpty, IsNumber } from 'class-validator';

// src/dto/field/create-field.dto.ts
export class CreateFieldDto {
    @IsNotEmpty()
    @IsNumber()
    branchId!: number;
  
    @IsNotEmpty()
    @IsNumber()
    typeId!: number;
  
    @IsNotEmpty()
    name!: string;
  
    @IsNotEmpty()
    priceDay!: number;
  
    @IsNotEmpty()
    priceNight!: number;
  }
  