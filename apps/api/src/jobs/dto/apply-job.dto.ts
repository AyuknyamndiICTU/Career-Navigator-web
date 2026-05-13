import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ApplyJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20_000)
  coverLetter!: string;
}
