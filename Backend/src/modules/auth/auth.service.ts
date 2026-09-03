import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RefreshSession, UserDocument } from '../users/schemas/user.schema';
import { UserRole } from '../../common/enums/user-role.enum';
// Phone/WhatsApp OTP is disabled while the WhatsApp provider (BuzzFlow) is down.
// import { WhatsappService } from '../whatsapp/whatsapp.service';
import { MailService } from '../mail/mail.service';
import { SchoolsService } from '../schools/schools.service';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    // Phone/WhatsApp OTP disabled (BuzzFlow outage) — parents get codes by email.
    // private readonly whatsapp: WhatsappService,
    private readonly mail: MailService,
    private readonly schoolsService: SchoolsService,
  ) {}

  /**
   * Blocks a suspended school's accounts from getting tokens. Applied on both
   * login (the common path for credential and OTP sign-in) and refresh, so a
   * school suspended mid-session loses access within the access-token lifetime.
   * The super admin has no school (schoolId null) and is never blocked.
   */
  private async assertSchoolNotSuspended(
    user: Pick<UserDocument, 'schoolId'>,
  ): Promise<void> {
    if (
      user.schoolId &&
      (await this.schoolsService.isSuspended(String(user.schoolId)))
    ) {
      throw new ForbiddenException(
        "This school's account has been suspended. Please contact the platform administrator.",
      );
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmailWithSecret(email);
    // No password → still a pending invite that was never activated.
    if (!user || !user.isActive || !user.password) {
      return null;
    }
    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      return null;
    }
    return user;
  }

  /** Starts a session on a new device. Existing devices keep their sessions. */
  async login(user: UserDocument): Promise<AuthTokens> {
    await this.assertSchoolNotSuspended(user);
    const userId = String(user._id);
    const sid = crypto.randomUUID();
    const tokens = await this.issueTokens(user, sid);
    const now = new Date();
    await this.usersService.addRefreshSession(
      userId,
      {
        sid,
        hash: await bcrypt.hash(tokens.refreshToken, 10),
        prevHash: null,
        prevValidUntil: null,
        createdAt: now,
        lastUsedAt: now,
      },
      this.config.get<number>('jwt.maxSessionsPerUser') ?? 5,
    );
    await this.usersService.markLogin(userId);
    return tokens;
  }

  async loginWithCredentials(
    email: string,
    password: string,
  ): Promise<AuthTokens> {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.login(user);
  }

  /// The refresh token is the only credential here — the access token it
  /// replaces is expected to be expired, so it cannot be trusted for identity.
  /// The device keeps its session (`sid`) across refreshes; only the token
  /// rotates, and the token it replaces stays usable for a short grace window.
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.verifyRefreshToken(refreshToken);
    if (!payload.sid) {
      // Pre-session token (issued before per-device sessions existed).
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.usersService.findByIdWithSessions(payload.sub);
    if (!user || !user.isActive) {
      throw new ForbiddenException('Access denied');
    }
    // A school suspended mid-session can't renew its users' tokens.
    await this.assertSchoolNotSuspended(user);
    const session = user.refreshSessions?.find((s) => s.sid === payload.sid);
    if (!session || !(await this.matchesSession(refreshToken, session))) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.issueTokens(user, session.sid);
    const graceSeconds = this.config.get<number>('jwt.refreshGraceSeconds') ?? 60;
    await this.usersService.rotateRefreshSession(String(user._id), session.sid, {
      hash: await bcrypt.hash(tokens.refreshToken, 10),
      prevHash: session.hash,
      prevValidUntil: new Date(Date.now() + graceSeconds * 1000),
    });
    return tokens;
  }

  /** Ends the session for the device that presents `refreshToken`. Without one
   *  (or with an unreadable one) every device is signed out, so a client that
   *  can't produce its token still gets a logout it can trust. */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      await this.usersService.clearRefreshSessions(userId);
      return;
    }
    let sid: string | undefined;
    try {
      const payload = await this.verifyRefreshToken(refreshToken, {
        ignoreExpiration: true,
      });
      sid = payload.sub === userId ? payload.sid : undefined;
    } catch {
      sid = undefined;
    }
    if (sid) {
      await this.usersService.removeRefreshSession(userId, sid);
    } else {
      await this.usersService.clearRefreshSessions(userId);
    }
  }

  private verifyRefreshToken(
    token: string,
    options: { ignoreExpiration?: boolean } = {},
  ): Promise<JwtPayload> {
    return this.jwtService
      .verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        ignoreExpiration: options.ignoreExpiration ?? false,
      })
      .catch(() => {
        throw new UnauthorizedException('Invalid or expired refresh token');
      });
  }

  /** True for the token currently issued to the device, or the one it replaced
   *  while that is still inside its grace window. */
  private async matchesSession(
    token: string,
    session: RefreshSession,
  ): Promise<boolean> {
    if (await bcrypt.compare(token, session.hash)) {
      return true;
    }
    const graceOpen =
      !!session.prevHash &&
      !!session.prevValidUntil &&
      session.prevValidUntil.getTime() > Date.now();
    return graceOpen && bcrypt.compare(token, session.prevHash as string);
  }

  // ── Invitation onboarding ───────────────────────────────

  /** Validates an invite token, returning who it's for (for the set-password page). */
  async getInvite(token: string): Promise<{ email: string; name: string }> {
    const user = await this.usersService.findByInvitationToken(token);
    if (!user) {
      throw new BadRequestException('This invitation is invalid or has expired');
    }
    return { email: user.email ?? '', name: user.name };
  }

  /** Sets the password on an invited account, activating it. */
  async acceptInvite(token: string, password: string): Promise<void> {
    const user = await this.usersService.findByInvitationToken(token);
    if (!user) {
      throw new BadRequestException('This invitation is invalid or has expired');
    }
    await this.usersService.activateWithPassword(String(user._id), password);
  }

  // ── Forgot / reset password (credential accounts) ───────

  /**
   * Emails a single-use reset link to a credential account (admin, teacher,
   * principal, …). Two roles are excluded (see findActiveCredentialByEmail):
   * parents, who log in with an OTP, and the super-admin, whose password is
   * developer-managed and must never be resettable over email.
   *
   * By product choice this rejects an unrecognised email with a clear error
   * rather than pretending to send — so a typo'd or parent/super-admin address
   * gets "invalid email" instead of a link that never arrives. The trade is
   * that it confirms whether an address is a staff account (no anti-enumeration
   * here, unlike the parent OTP flow). A *delivery* failure is still surfaced
   * separately, after dropping the token.
   */
  async requestPasswordReset(email: string): Promise<{ sent: true }> {
    const user = await this.usersService.findActiveCredentialByEmail(email);
    if (!user) {
      throw new BadRequestException(
        'No admin or teacher account is registered with this email.',
      );
    }

    const ttlMinutes = this.config.get<number>('app.resetTtlMinutes') ?? 60;
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Store first: a link that reached the user but was never persisted would
    // be rejected on use, the worse way round to fail.
    await this.usersService.setPasswordReset(String(user._id), hash, expiresAt);

    const resetUrl = this.mail.buildResetUrl(rawToken);
    const delivered = await this.mail.sendPasswordReset(
      email,
      user.name,
      resetUrl,
      ttlMinutes,
    );
    if (!delivered) {
      await this.usersService.clearPasswordReset(String(user._id));
      throw new ServiceUnavailableException(
        'We could not send your reset link right now. Please try again in a moment.',
      );
    }

    return { sent: true };
  }

  /** Validates a reset token, returning who it's for (for the reset page). */
  async getPasswordReset(token: string): Promise<{ email: string; name: string }> {
    const user = await this.usersService.findByPasswordResetToken(token);
    if (!user) {
      throw new BadRequestException(
        'This reset link is invalid or has expired',
      );
    }
    return { email: user.email ?? '', name: user.name };
  }

  /** Sets a new password from a reset token, ending all existing sessions. */
  async resetPassword(token: string, password: string): Promise<void> {
    const user = await this.usersService.findByPasswordResetToken(token);
    if (!user) {
      throw new BadRequestException(
        'This reset link is invalid or has expired',
      );
    }
    await this.usersService.resetPasswordWithToken(String(user._id), password);
  }

  // ── Email-OTP login (parents) ───────────────────────────
  //
  // TEMPORARY: parents receive their login code by EMAIL while the WhatsApp
  // provider (BuzzFlow) is down. The phone/WhatsApp versions are preserved,
  // commented out below, and should be restored once WhatsApp is back.

  /**
   * Sends a one-time login code to a parent's email.
   *
   * An unknown email resolves exactly like a known one, so callers can't probe
   * which parents are registered.
   *
   * A *delivery* failure does surface, though, which is a deliberate trade:
   * it narrows the anti-enumeration guarantee to "while email is healthy", and
   * buys a parent being told the code isn't coming instead of watching an empty
   * inbox. The leak needs delivery to already be broken; the silent version
   * strands every parent every time.
   */
  async requestOtp(email: string): Promise<{ sent: true }> {
    const user = await this.usersService.findActiveByEmailForRole(
      email,
      UserRole.PARENT,
    );
    if (!user) {
      // Server-side only, so a real deployment can still tell an unregistered
      // email apart from a delivery problem.
      this.logger.warn(
        `OTP requested for ${email} but no active parent account matches it`,
      );
      return { sent: true };
    }

    const length = this.config.get<number>('app.otpLength') ?? 6;
    const ttlMinutes = this.config.get<number>('app.otpTtlMinutes') ?? 5;
    const code = this.generateNumericCode(length);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Store first: a code that reached the parent but was never persisted
    // would be rejected on verify, which is the worse way round to fail.
    await this.usersService.setOtp(String(user._id), this.hashCode(code), expiresAt);

    const delivered = await this.mail.sendOtp(email, code, ttlMinutes);
    if (!delivered) {
      // Drop the stored code — leaving a live one behind for a message nobody
      // received only widens the window for a guess to land.
      await this.usersService.clearOtp(String(user._id));
      throw new ServiceUnavailableException(
        'We could not send your code right now. Please try again in a moment.',
      );
    }

    return { sent: true };
  }

  /** Verifies a parent's one-time code and, on success, issues tokens. */
  async verifyOtp(email: string, code: string): Promise<AuthTokens> {
    const user = await this.usersService.findActiveByEmailForRole(
      email,
      UserRole.PARENT,
    );
    const expired =
      !user?.otpHash ||
      !user.otpExpiresAt ||
      user.otpExpiresAt.getTime() < Date.now();
    if (!user || expired) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const maxAttempts = this.config.get<number>('app.otpMaxAttempts') ?? 5;
    if ((user.otpAttempts ?? 0) >= maxAttempts) {
      await this.usersService.clearOtp(String(user._id));
      throw new UnauthorizedException('Too many attempts. Request a new code.');
    }

    if (this.hashCode(code) !== user.otpHash) {
      const attempts = await this.usersService.incrementOtpAttempts(
        String(user._id),
      );
      if (attempts >= maxAttempts) {
        await this.usersService.clearOtp(String(user._id));
      }
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.usersService.clearOtp(String(user._id));
    return this.login(user);
  }

  // ── Phone/WhatsApp-OTP login (parents) — DISABLED (BuzzFlow outage) ──────
  // Restore these two methods (and switch the controller + DTOs + app back to
  // `phone`) once the WhatsApp provider is healthy again. Re-inject
  // WhatsappService in the constructor above when you do.
  //
  // async requestOtp(phone: string): Promise<{ sent: true }> {
  //   const user = await this.usersService.findActiveByPhoneForRole(
  //     phone,
  //     UserRole.PARENT,
  //   );
  //   if (!user) {
  //     this.logger.warn(
  //       `OTP requested for ${phone} but no active parent account matches it`,
  //     );
  //     return { sent: true };
  //   }
  //   const length = this.config.get<number>('app.otpLength') ?? 6;
  //   const ttlMinutes = this.config.get<number>('app.otpTtlMinutes') ?? 5;
  //   const code = this.generateNumericCode(length);
  //   const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  //   await this.usersService.setOtp(
  //     String(user._id),
  //     this.hashCode(code),
  //     expiresAt,
  //   );
  //   const delivered = await this.whatsapp.sendOtp(phone, code, ttlMinutes);
  //   if (!delivered) {
  //     await this.usersService.clearOtp(String(user._id));
  //     throw new ServiceUnavailableException(
  //       'We could not send your code right now. Please try again in a moment.',
  //     );
  //   }
  //   return { sent: true };
  // }
  //
  // async verifyOtp(phone: string, code: string): Promise<AuthTokens> {
  //   const user = await this.usersService.findActiveByPhoneForRole(
  //     phone,
  //     UserRole.PARENT,
  //   );
  //   const expired =
  //     !user?.otpHash ||
  //     !user.otpExpiresAt ||
  //     user.otpExpiresAt.getTime() < Date.now();
  //   if (!user || expired) {
  //     throw new UnauthorizedException('Invalid or expired code');
  //   }
  //   const maxAttempts = this.config.get<number>('app.otpMaxAttempts') ?? 5;
  //   if ((user.otpAttempts ?? 0) >= maxAttempts) {
  //     await this.usersService.clearOtp(String(user._id));
  //     throw new UnauthorizedException('Too many attempts. Request a new code.');
  //   }
  //   if (this.hashCode(code) !== user.otpHash) {
  //     const attempts = await this.usersService.incrementOtpAttempts(
  //       String(user._id),
  //     );
  //     if (attempts >= maxAttempts) {
  //       await this.usersService.clearOtp(String(user._id));
  //     }
  //     throw new UnauthorizedException('Invalid or expired code');
  //   }
  //   await this.usersService.clearOtp(String(user._id));
  //   return this.login(user);
  // }

  private generateNumericCode(length: number): string {
    const max = 10 ** length;
    const n = crypto.randomInt(0, max);
    return n.toString().padStart(length, '0');
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private async issueTokens(
    user: UserDocument,
    sid: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: String(user._id),
      email: user.email ?? '',
      role: user.role,
      schoolId: user.schoolId ? String(user.schoolId) : null,
    };
    type ExpiresIn = JwtSignOptions['expiresIn'];
    const accessOptions: JwtSignOptions = {
      secret: this.config.get<string>('jwt.secret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn') as ExpiresIn,
    };
    const refreshOptions: JwtSignOptions = {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshExpiresIn') as ExpiresIn,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, accessOptions),
      // Only the refresh token names the device — the access token is the same
      // for every session, so nothing downstream has to know about `sid`.
      this.jwtService.signAsync({ ...payload, sid }, refreshOptions),
    ]);
    return { accessToken, refreshToken };
  }
}
