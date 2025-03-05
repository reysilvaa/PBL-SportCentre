import { IsNotEmpty, IsNumber } from 'class-validator';

// src/dto/branch/create-branch.dto.ts
export class CreateBranchDto {
  @IsNotEmpty()
  name!: string;

  @IsNotEmpty()
  location!: string;

  @IsNotEmpty()
  @IsNumber()
  ownerId!: number;
}

