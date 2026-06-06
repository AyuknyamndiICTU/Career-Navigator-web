import { IsOptional, IsString, IsIn } from 'class-validator';

export type ResumeTemplateId = 'CLASSIC' | 'MODERN' | 'MINIMAL';

export class BuildResumeDto {
  @IsOptional()
  @IsString()
  @IsIn(['CLASSIC', 'MODERN', 'MINIMAL'])
  template?: ResumeTemplateId;
}
