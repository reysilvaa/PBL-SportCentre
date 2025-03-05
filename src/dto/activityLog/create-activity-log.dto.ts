import { IsNotEmpty, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateActivityLogDto {
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt({ message: 'userId must be an integer' })
  userId!: number;

  @IsNotEmpty()
  action!: string;
}
