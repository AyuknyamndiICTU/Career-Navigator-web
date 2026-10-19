import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { OtpPurpose } from '../prisma/client';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { SetThemePreferenceDto } from './dto/theme.dto';
import { BrevoEmailer } from './email/brevo-emailer';
import { generate6DigitCode, hashOtpCode } from './otp/otp-utils';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './jwt/jwt-utils';

const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const REGISTER_PURPOSE: OtpPurpose = 'REGISTER';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const { email, password } = dto;

    const otpEmailLogOnly = env.otp.emailLogOnly;

    const brevoApiKey = env.brevo.apiKey;
    const brevoSenderEmail = env.brevo.senderEmail;

    if (!otpEmailLogOnly && (!brevoApiKey || !brevoSenderEmail)) {
      throw new BadRequestException('Email OTP configuration is missing');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.isActive) {
        throw new BadRequestException(
          'This email address is already registered. Please log in instead.',
        );
      }

      // In OTP log-only/dev mode, auto-activate so the user can login immediately.
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          isActive: otpEmailLogOnly,
        },
      });
    } else {
      await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          isActive: otpEmailLogOnly,
        },
      });
    }

    // Get the user ID (either newly created or updated)
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { email },
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
      // Local/dev mode: don't call external email provider (validateEnv forbids this in production).
      this.logger.warn(`[DEV OTP] Register OTP for ${email}: ${code}`);
      return { message: 'OTP generated (check server logs)' };
    }

    const emailer = new BrevoEmailer();
    try {
      await emailer.sendOtpEmail({
        apiKey: brevoApiKey!,
        senderEmail: brevoSenderEmail!,
        toEmail: email,
        otpCode: code,
      });

      return { message: 'OTP sent to email' };
    } catch (e) {
      this.logger.error(`Brevo OTP email failed: ${String(e)}`);

      // Never write a live OTP into production logs.
      if (env.isProduction) {
        throw new ServiceUnavailableException(
          'Could not send the verification email. Please try again shortly.',
        );
      }

      // Dev/staging: don't block signup on a misconfigured Brevo account.
      this.logger.warn(`[DEV OTP] Register OTP for ${email}: ${code}`);

      return { message: 'OTP generated (check server logs)' };
    }
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
    const accessSecret = env.jwt.accessSecret;
    const refreshSecret = env.jwt.refreshSecret;

    if (!accessSecret || !refreshSecret) {
      throw new BadRequestException('JWT secrets are not configured');
    }

    const accessExpiresIn = env.jwt.accessExpiresIn;
    const refreshExpiresIn = env.jwt.refreshExpiresIn;

    return { accessSecret, refreshSecret, accessExpiresIn, refreshExpiresIn };
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    refreshExpiresAt: Date;
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

    const {
      token: refreshToken,
      jti,
      expiresAt,
    } = signRefreshToken({
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
      userId: user.id,
    });

    const tokenHash = hashToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    refreshExpiresAt: Date;
  }> {
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

    const {
      token: newRefreshToken,
      jti,
      expiresAt: newExpiresAt,
    } = signRefreshToken({
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
      userId: user.id,
    });

    const newTokenHash = hashToken(newRefreshToken);

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

    return {
      accessToken,
      refreshToken: newRefreshToken,
      refreshExpiresAt: newExpiresAt,
    };
  }

  async logout(refreshToken: string | undefined): Promise<{ message: string }> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return { message: 'Logged out' };
  }

  async requestPasswordReset(
    dto: PasswordResetRequestDto,
  ): Promise<{ message: string }> {
    const { email } = dto;

    const otpEmailLogOnly = env.otp.emailLogOnly;

    const brevoApiKey = env.brevo.apiKey;
    const brevoSenderEmail = env.brevo.senderEmail;

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
      this.logger.warn(`[DEV OTP] Password reset OTP for ${email}: ${code}`);
      return {
        message:
          'If the account exists, a reset code was generated (check server logs).',
      };
    }

    const emailer = new BrevoEmailer();
    await emailer.sendOtpEmail({
      apiKey: brevoApiKey!,
      senderEmail: brevoSenderEmail!,
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

  async deactivate(userId: string): Promise<{ message: string }> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false, deactivatedAt: now },
      });

      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });

      // Users' own AI keys are deleted immediately, not kept with the dormant account.
      await tx.userAiCredential.deleteMany({ where: { userId } });
    });

    return { message: 'Account deactivated' };
  }

  async getTheme(userId: string): Promise<{
    themePreference: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { themePreference: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return { themePreference: user.themePreference };
  }

  async setTheme(
    userId: string,
    dto: SetThemePreferenceDto,
  ): Promise<{ themePreference: string }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { themePreference: dto.themePreference as any },
      select: { themePreference: true },
    });

    return { themePreference: user.themePreference };
  }
}
