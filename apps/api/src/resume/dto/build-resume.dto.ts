import { IsOptional, IsString, IsIn } from 'class-validator';

export type ResumeTemplateId = 'STANDARD' | 'DETAILED';

export class BuildResumeDto {
  @IsOptional()
  @IsString()
  @IsIn(['STANDARD', 'DETAILED'])
  template?: ResumeTemplateId;
}
