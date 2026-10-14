import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  // Browsers send the httpOnly cookie instead; the body field is for non-browser clients.
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
