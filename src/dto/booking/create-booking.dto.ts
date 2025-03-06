import { IsNotEmpty, IsNumber, IsDate, IsString, Matches } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import 'reflect-metadata';

// src/dto/booking/create-booking.dto.ts
export class CreateBookingDto {
  @IsNotEmpty()
  @IsNumber()
  userId!: number;

  @IsNotEmpty()
  @IsNumber()
  fieldId!: number;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  bookingDate!: Date;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/) // Format HH:MM
  startTime!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/) // Format HH:MM
  endTime!: string;

}