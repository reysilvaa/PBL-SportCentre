import { IsNotEmpty, IsNumber, IsDateString, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsNotEmpty()
  @IsNumber()
  userId!: number;

  @IsNotEmpty()
  @IsNumber()
  fieldId!: number;

  @IsNotEmpty()
  @IsDateString()
  bookingDate!: string;

  @IsNotEmpty()
  @IsString()
  startTime!: string;

  @IsNotEmpty()
  @IsString()
  endTime!: string;
}