import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class MockInterviewRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  role!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  allowedSkills?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}
