import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateActivityLogDto {
    @IsNotEmpty()
    @IsNumber()
    userId!: number;
  
    @IsNotEmpty()
    action!: string;
  }
  