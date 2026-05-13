import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { SetThemePreferenceDto } from './dto/theme.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOkResponse({ description: 'OTP sent to the user email address.' })
  @ApiBadRequestResponse({
    description: 'Missing configuration or invalid input.',
  })
  async register(@Body() dto: RegisterDto): Promise<{ message: string }> {
    return this.authService.register(dto);
  }

  @Post('verify-otp')
  @ApiOkResponse({
    description: 'Email verified and account activated.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired OTP.',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<{ message: string; isActive: boolean }> {
    return this.authService.verifyRegisterOtp(dto);
  }

  @Post('login')
  @ApiOkResponse({
    description: 'Returns access token + refresh token.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or inactive account.',
  })
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOkResponse({
    description: 'Returns a rotated refresh token and new access token.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid, revoked, or expired refresh token.',
  })
  async refresh(
    @Body() dto: RefreshDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refresh(dto);
  }

  @Post('password-reset/request')
  @ApiOkResponse({
    description: 'Password reset OTP sent to email (or generic response).',
  })
  async requestPasswordReset(
    @Body() dto: PasswordResetRequestDto,
  ): Promise<{ message: string }> {
    return await this.authService.requestPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  @ApiOkResponse({
    description: 'Password updated after OTP verification.',
  })
  async confirmPasswordReset(
    @Body() dto: PasswordResetConfirmDto,
  ): Promise<{ message: string }> {
    return await this.authService.confirmPasswordReset(dto);
  }

  @Post('deactivate')
  @ApiOkResponse({
    description: 'Account deactivated and refresh tokens revoked.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async deactivate(
    @Headers('authorization') authorization?: string,
  ): Promise<{ message: string }> {
    return await this.authService.deactivate(authorization ?? '');
  }

  @Get('theme')
  @ApiOkResponse({
    description: 'Returns current theme preference.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async getTheme(
    @Headers('authorization') authorization?: string,
  ): Promise<{ themePreference: string }> {
    return await this.authService.getTheme(authorization ?? '');
  }

  @Post('theme')
  @ApiOkResponse({
    description: 'Updates theme preference.',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async setTheme(
    @Headers('authorization') authorization: string,
    @Body() dto: SetThemePreferenceDto,
  ): Promise<{ themePreference: string }> {
    return await this.authService.setTheme(authorization, dto);
  }
}
