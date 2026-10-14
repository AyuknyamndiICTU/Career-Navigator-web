import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { SetThemePreferenceDto } from './dto/theme.dto';
import { API_PREFIX } from '../lib/api-prefix';

const REFRESH_COOKIE = 'cn_refresh';

function refreshCookieOptions(expires?: Date): CookieOptions {
  const secureOverride = process.env.COOKIE_SECURE;
  return {
    httpOnly: true,
    secure: secureOverride
      ? secureOverride === 'true'
      : process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/${API_PREFIX}/auth`,
    ...(expires ? { expires } : {}),
  };
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

function assertAllowedOrigin(req: Request): void {
  const origin = req.headers.origin;
  const allowed = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (!origin || !allowed || allowed === '*') return;

  const allowedOrigins = allowed.split(',').map((o) => o.trim());
  if (!allowedOrigins.includes(origin)) {
    throw new ForbiddenException('Origin not allowed');
  }
}

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
    description:
      'Returns an access token and sets the refresh token as an httpOnly cookie.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or inactive account.',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const { accessToken, refreshToken, refreshExpiresAt } =
      await this.authService.login(dto);

    res.cookie(
      REFRESH_COOKIE,
      refreshToken,
      refreshCookieOptions(refreshExpiresAt),
    );
    return { accessToken };
  }

  @Post('refresh')
  @ApiOkResponse({
    description:
      'Rotates the refresh token cookie and returns a new access token.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid, revoked, or expired refresh token.',
  })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    assertAllowedOrigin(req);

    const token = readCookie(req, REFRESH_COOKIE) ?? dto.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Missing refresh token');
    }

    try {
      const { accessToken, refreshToken, refreshExpiresAt } =
        await this.authService.refresh(token);

      res.cookie(
        REFRESH_COOKIE,
        refreshToken,
        refreshCookieOptions(refreshExpiresAt),
      );
      return { accessToken };
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Revokes the refresh token and clears the cookie.',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    assertAllowedOrigin(req);

    const token = readCookie(req, REFRESH_COOKIE);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    return this.authService.logout(token);
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
