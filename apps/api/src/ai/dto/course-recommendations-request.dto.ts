import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CourseRecommendationsRequestDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedSkills?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studentGoal?: string;
}
