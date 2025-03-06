import { IsNotEmpty, IsNumber, IsInt, Min, Max, IsString } from 'class-validator';

export class CreateFieldReviewDto {
  @IsNotEmpty()
  @IsInt()
  userId!: number;

  @IsNotEmpty()
  @IsInt()
  fieldId!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsNotEmpty()
  @IsString()
  review!: string;
}
