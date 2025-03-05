import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsEnum } from 'class-validator';

// src/dto/auth/register.dto.ts
export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEnum(['user', 'admin_cabang', 'owner_cabang', 'super_admin'])
  role?: 'user' | 'admin_cabang' | 'owner_cabang' | 'super_admin';
}

