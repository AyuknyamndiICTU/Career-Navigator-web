import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;

  // Optional: if provided, we enforce that the AI response stays within these “career path” skills.
  // If omitted, we fall back to deriving skills from the user’s job applications.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedSkills?: string[];
}
