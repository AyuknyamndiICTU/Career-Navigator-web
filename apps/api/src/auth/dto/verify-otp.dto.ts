/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  // Keep as string to preserve leading zeros.
  code!: string;
}
