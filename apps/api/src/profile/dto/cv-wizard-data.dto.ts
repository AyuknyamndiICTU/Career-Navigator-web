import { IsEmail, IsOptional, IsString, IsUrl, IsArray } from 'class-validator';

export class CvWizardDataDto {
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid website URL' })
  website?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid LinkedIn URL' })
  linkedIn?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid photo URL' })
  photoUrl?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  additionalInformation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  achievementsAwards?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  publications?: string[];

  @IsOptional()
  @IsString()
  signature?: string;
}
