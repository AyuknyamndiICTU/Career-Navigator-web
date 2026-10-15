import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ChatHistoryItemDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(8000)
  content!: string;
}

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;

  // Optional: if provided, we enforce that the AI response stays within these "career path" skills.
  // If omitted, we fall back to deriving skills from the user's job applications.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  allowedSkills?: string[];

  /** Earlier turns, oldest first; only the last 6 are sent verbatim. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[];
}
