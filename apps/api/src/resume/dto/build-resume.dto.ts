import { IsOptional, IsString, IsIn } from 'class-validator';

export type ResumeTemplateId =
  | 'CLASSIC'
  | 'MODERN'
  | 'MINIMAL'
  | 'CREATIVE'
  | 'PROFESSIONAL'
  | 'EXECUTIVE';

export class BuildResumeDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'CLASSIC',
    'MODERN',
    'MINIMAL',
    'CREATIVE',
    'PROFESSIONAL',
    'EXECUTIVE',
  ])
  template?: ResumeTemplateId;
}
