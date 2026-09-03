import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

/**
 * Rate limits for the unauthenticated surface.
 *
 * The global allowance (120/min) is sized for ordinary API traffic and is far
 * too generous here: it would let one client try thousands of passwords or
 * one-time codes an hour, and send a victim an unlimited number of emails.
 *
 * These key on client IP, and a school's staff often share one NAT address —
 * so they are set high enough that a morning's worth of legitimate sign-ins
 * never trips them, while still cutting automated guessing by orders of
 * magnitude. Per-account limits do the precise work: the OTP has a 5-attempt
 * cap, and each code is single-use.
 *
 * Behind a proxy these are only meaningful with TRUST_PROXY_HOPS set —
 * otherwise every request carries the proxy's IP and shares one bucket.
 */
const LIMIT = {
  /** Password guessing. */
  login: { default: { limit: 20, ttl: 300_000 } },
  /** Code guessing. The per-account 5-attempt cap is the other half of this. */
  otpVerify: { default: { limit: 20, ttl: 300_000 } },
  /** Sending mail to someone else's address — the abuse here is the sending. */
  otpRequest: { default: { limit: 10, ttl: 900_000 } },
  passwordReset: { default: { limit: 10, ttl: 900_000 } },
  /** Token-guessing on the invite and reset links. */
  token: { default: { limit: 30, ttl: 900_000 } },
} as const;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle(LIMIT.login)
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.loginWithCredentials(dto.email, dto.password);
  }

  /** Public: validate an invite token so the set-password page can show the email. */
  @Throttle(LIMIT.token)
  @Get('invite')
  getInvite(@Query('token') token: string) {
    return this.authService.getInvite(token);
  }

  /** Public: an invited user sets their password, activating the account. */
  @Throttle(LIMIT.token)
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto.token, dto.password);
  }

  /** Public: a credential user requests a password-reset link by email.
   *  Resolves the same whether or not the email has an account. */
  @Throttle(LIMIT.passwordReset)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  /** Public: validate a reset token so the reset page can show the email. */
  @Throttle(LIMIT.token)
  @Get('reset-password')
  getPasswordReset(@Query('token') token: string) {
    return this.authService.getPasswordReset(token);
  }

  /** Public: a user sets a new password from their reset link. */
  @Throttle(LIMIT.token)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  /** Public: parent requests a one-time login code sent to their email.
   *  TEMPORARY: email stands in for WhatsApp while that provider is down. */
  @Throttle(LIMIT.otpRequest)
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.email);
  }

  /** Public: parent verifies the one-time code and receives tokens. */
  @Throttle(LIMIT.otpVerify)
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /** Ends this device's session; without a refresh token, ends all of them. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) {
    await this.authService.logout(user.userId, dto.refreshToken);
  }
}
