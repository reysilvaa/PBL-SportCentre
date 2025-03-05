import { IsNotEmpty, IsNumber, IsDate } from 'class-validator';

// src/dto/booking/create-booking.dto.ts
export class CreateBookingDto {
  @IsNotEmpty()
  @IsNumber()
  userId!: number;

  @IsNotEmpty()
  @IsNumber()
  fieldId!: number;

  @IsNotEmpty()
  @IsDate()
  bookingDate!: Date;

  @IsNotEmpty()
  @IsDate()
  startTime!: Date;

  @IsNotEmpty()
  @IsDate()
  endTime!: Date;
}