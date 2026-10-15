import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const AI_PROVIDER_VALUES = [
  'GEMINI',
  'OPENAI',
  'ANTHROPIC',
  'OPENROUTER',
  'OLLAMA_CLOUD',
] as const;

export class CreateAiCredentialDto {
  @IsIn(AI_PROVIDER_VALUES)
  provider!: (typeof AI_PROVIDER_VALUES)[number];

  @IsString()
  @MinLength(8)
  @MaxLength(400)
  apiKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsIn(['FREE', 'PAID'])
  tier?: 'FREE' | 'PAID';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  monthlyBudgetUsd?: number;

  /** OpenAI-compatible keys only; host must be on AI_BYOK_ALLOWED_HOSTS. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  baseUrl?: string;
}

export class UpdateAiCredentialDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsIn(['FREE', 'PAID'])
  tier?: 'FREE' | 'PAID';

  /** null removes the budget. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  monthlyBudgetUsd?: number | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}

export class AiTaskPreferenceDto {
  @IsString()
  @MaxLength(40)
  task!: string;

  /** null = use the platform's free AI for this feature. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(60)
  credentialId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;
}

export class UpdateAiPreferencesDto {
  @IsOptional()
  @IsBoolean()
  fallbackToPlatform?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AiTaskPreferenceDto)
  tasks?: AiTaskPreferenceDto[];
}

export class UpsertAiPriceDto {
  @IsIn(AI_PROVIDER_VALUES)
  provider!: (typeof AI_PROVIDER_VALUES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  model!: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(10_000)
  inputPerMTok!: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(10_000)
  outputPerMTok!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(10_000)
  cachedInputPerMTok?: number | null;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;
}

export class UsageQueryDto {
  @IsOptional()
  @IsIn(['today', 'month', '30d', 'custom'])
  range?: 'today' | 'month' | '30d' | 'custom';

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(['task', 'provider', 'model', 'credential', 'day'])
  groupBy?: 'task' | 'provider' | 'model' | 'credential' | 'day';
}
