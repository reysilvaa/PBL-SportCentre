import { IsEmail, IsNotEmpty } from 'class-validator';

// src/dto/auth/login.dto.ts
export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  password!: string;
}

