import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { SetThemePreferenceDto } from './dto/theme.dto';
import { BrevoEmailer } from './email/brevo-emailer';
import { generate6DigitCode, hashOtpCode } from './otp/otp-utils';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt/jwt-utils';

const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const REGISTER_PURPOSE: OtpPurpose = 'REGISTER';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const { email, password } = dto;

    const otpEmailLogOnly = process.env.OTP_EMAIL_LOG_ONLY === 'true';

    const brevoApiKey = process.env.BREVO_API_KEY;
    const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL;

    if (!otpEmailLogOnly && (!brevoApiKey || !brevoSenderEmail)) {
      throw new BadRequestException('Email OTP configuration is missing');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        isActive: false,
      },
      update: {
        // Keep user inactive until OTP is verified.
        isActive: false,
        passwordHash,
      },
    });

    const code = generate6DigitCode();
    const codeHash = hashOtpCode(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    await this.prisma.emailVerificationOtp.create({
      data: {
        userId: user.id,
        purpose: REGISTER_PURPOSE,
        codeHash,
        expiresAt,
        attempts: 0,
      },
    });

    if (otpEmailLogOnly) {
      // Local/dev mode: don't call external email provider.
      // eslint-disable-next-line no-console
      console.log(`[DEV OTP] Register OTP for ${email}: ${code}`);
      return { message: 'OTP generated (check server logs)' };
    }

    const emailer = new BrevoEmailer();
    await emailer.sendOtpEmail({
      apiKey: brevoApiKey,
      senderEmail: brevoSenderEmail,
      toEmail: email,
      otpCode: code,
    });

    return { message: 'OTP sent to email' };
  }

  async verifyRegisterOtp(
    dto: VerifyOtpDto,
  ): Promise<{ message: string; isActive: boolean }> {
    const { email, code } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or OTP');
    }

    const otp = await this.prisma.emailVerificationOtp.findFirst({
      where: {
        userId: user.id,
        purpose: REGISTER_PURPOSE,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const matches = hashOtpCode(code) === otp.codeHash;

    if (!matches) {
      const nextAttempts = otp.attempts + 1;

      await this.prisma.emailVerificationOtp.update({
        where: { id: otp.id },
        data: { attempts: nextAttempts },
      });

      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        throw new UnauthorizedException('OTP attempt limit exceeded');
      }

      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { isActive: true },
      });

      await tx.emailVerificationOtp.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });
    });

    return { message: 'Email verified', isActive: true };
  }

  private getJwtSecretsOrThrow() {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret || !refreshSecret) {
      throw new BadRequestException('JWT secrets are not configured');
    }

    const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';

    return { accessSecret, refreshSecret, accessExpiresIn, refreshExpiresIn };
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const { email, password } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is not active');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessSecret, refreshSecret, accessExpiresIn, refreshExpiresIn } =
      this.getJwtSecretsOrThrow();

    const accessToken = signAccessToken({
      secret: accessSecret,
      expiresIn: accessExpiresIn,
      userId: user.id,
      email: user.email,
      isActive: user.isActive,
    });

    const { token: refreshToken, jti } = signRefreshToken({
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
      userId: user.id,
    });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000); // default 30d fallback

    // Note: we keep expiresAt aligned with env default; for now we don't parse refreshExpiresIn reliably.
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async refresh(dto: RefreshDto): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const { refreshToken } = dto;

    const { accessSecret, refreshSecret, accessExpiresIn, refreshExpiresIn } =
      this.getJwtSecretsOrThrow();

    verifyRefreshToken({
      secret: refreshSecret,
      token: refreshToken,
    });

    const tokenHash = hashToken(refreshToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      // Reuse protection: revoke all active tokens for this user.
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: existing.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: existing.userId },
      select: { id: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is not active');
    }

    const accessToken = signAccessToken({
      secret: accessSecret,
      expiresIn: accessExpiresIn,
      userId: user.id,
      email: user.email,
      isActive: user.isActive,
    });

    const { token: newRefreshToken, jti } = signRefreshToken({
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
      userId: user.id,
    });

    const newTokenHash = hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          jti,
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
        },
      });
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async requestPasswordReset(
    dto: PasswordResetRequestDto,
  ): Promise<{ message: string }> {
    const { email } = dto;

    const otpEmailLogOnly = process.env.OTP_EMAIL_LOG_ONLY === 'true';

    const brevoApiKey = process.env.BREVO_API_KEY;
    const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL;

    if (!otpEmailLogOnly && (!brevoApiKey || !brevoSenderEmail)) {
      throw new BadRequestException('Email OTP configuration is missing');
    }

    // Avoid user enumeration: always return a generic message.
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return { message: 'If the account exists, a reset code was sent.' };
    }

    const code = generate6DigitCode();
    const codeHash = hashOtpCode(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    await this.prisma.emailVerificationOtp.create({
      data: {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        codeHash,
        expiresAt,
        attempts: 0,
      },
    });

    if (otpEmailLogOnly) {
      // eslint-disable-next-line no-console
      console.log(`[DEV OTP] Password reset OTP for ${email}: ${code}`);
      return {
        message:
          'If the account exists, a reset code was generated (check server logs).',
      };
    }

    const emailer = new BrevoEmailer();
    await emailer.sendOtpEmail({
      apiKey: brevoApiKey,
      senderEmail: brevoSenderEmail,
      toEmail: email,
      otpCode: code,
    });

    return { message: 'If the account exists, a reset code was sent.' };
  }

  async confirmPasswordReset(
    dto: PasswordResetConfirmDto,
  ): Promise<{ message: string }> {
    const { email, code, newPassword } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or reset code');
    }

    const otp = await this.prisma.emailVerificationOtp.findFirst({
      where: {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    const matches = hashOtpCode(code) === otp.codeHash;
    if (!matches) {
      throw new UnauthorizedException('Invalid reset code');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      await tx.emailVerificationOtp.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });

      // Security: revoke all refresh tokens after password change.
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Password has been reset.' };
  }

  async deactivate(authorizationHeader: string): Promise<{ message: string }> {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    if (!authorizationHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authorizationHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = verifyAccessToken({ secret: accessSecret, token });

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: payload.sub },
        data: { isActive: false, deactivatedAt: now },
      });

      await tx.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: now },
      });
    });

    return { message: 'Account deactivated' };
  }

  async getTheme(authorizationHeader: string): Promise<{
    themePreference: string;
  }> {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const token = authorizationHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = verifyAccessToken({ secret: accessSecret, token });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { themePreference: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return { themePreference: user.themePreference };
  }

  async setTheme(
    authorizationHeader: string,
    dto: SetThemePreferenceDto,
  ): Promise<{ themePreference: string }> {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const token = authorizationHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = verifyAccessToken({ secret: accessSecret, token });

    const user = await this.prisma.user.update({
      where: { id: payload.sub },
      data: { themePreference: dto.themePreference as any },
      select: { themePreference: true },
    });

    return { themePreference: user.themePreference };
  }
}
