import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CourseRecommendationsRequestDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  allowedSkills?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studentGoal?: string;
}
