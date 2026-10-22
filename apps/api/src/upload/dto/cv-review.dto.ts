import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CvConfirmEducationDto {
  @IsOptional() @IsString() @MaxLength(200) degree?: string | null;
  @IsOptional() @IsString() @MaxLength(200) fieldOfStudy?: string | null;
  @IsOptional() @IsString() @MaxLength(200) institution?: string | null;
  @IsOptional() @IsInt() @Min(1950) @Max(2100) startYear?: number | null;
  @IsOptional() @IsInt() @Min(1950) @Max(2100) endYear?: number | null;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
  @IsOptional() @IsString() @MaxLength(100) grade?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
}

export class CvConfirmExperienceDto {
  @IsOptional() @IsString() @MaxLength(200) jobTitle?: string | null;
  @IsOptional() @IsString() @MaxLength(200) company?: string | null;
  @IsOptional() @IsString() @MaxLength(200) location?: string | null;
  @IsOptional() @IsInt() @Min(1950) @Max(2100) startYear?: number | null;
  @IsOptional() @IsInt() @Min(1950) @Max(2100) endYear?: number | null;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
}

/** The reviewed CV the user approves (16.7). Only sent fields are applied. */
export class CvConfirmDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) fullName?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) location?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) summary?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) linkedIn?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) website?:
    | string
    | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(150)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  skills?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  languages?: string[];

  @ApiPropertyOptional({ type: [CvConfirmEducationDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CvConfirmEducationDto)
  education?: CvConfirmEducationDto[];

  @ApiPropertyOptional({ type: [CvConfirmExperienceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => CvConfirmExperienceDto)
  experience?: CvConfirmExperienceDto[];
}

export const CV_ASSIST_SECTIONS = [
  'summary',
  'education',
  'experience',
  'skills',
] as const;

export class CvAssistDto {
  @ApiProperty({ enum: CV_ASSIST_SECTIONS })
  @IsIn(CV_ASSIST_SECTIONS)
  section!: (typeof CV_ASSIST_SECTIONS)[number];
}
