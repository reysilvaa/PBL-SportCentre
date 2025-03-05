import { IsNotEmpty } from 'class-validator';

export class CreateFieldTypeDto {
    @IsNotEmpty()
    name!: string;
  }
  