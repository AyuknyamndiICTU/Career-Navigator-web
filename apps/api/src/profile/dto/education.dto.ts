/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateEducationDto {
  @IsOptional()
  @IsString()
  degree?: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsInt()
  startYear?: number;

  @IsOptional()
  @IsInt()
  endYear?: number;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class UpdateEducationDto extends CreateEducationDto {}
