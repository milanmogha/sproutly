import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { isAlwaysWritable } from './subscription-policy';

/** Methods that change something. Reads are never blocked. */
const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Enforces the subscription on writes.
 *
 * Two tiers, because the school owing money and the parents using the app are
 * not the same people:
 *
 *  - **admin** goes read-only once the grace window closes (expiry + 5 days)
 *  - **everyone else** only at expiry + 30 days, and is told nothing about
 *    billing — it isn't their business
 *
 * Reads always work, so a locked school can still look up a phone number or a
 * child's attendance. The super admin is never affected: they don't belong to
 * a school, and they're the one who fixes this.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Reads the caller from the bearer token.
   *
   * This guard is registered globally, and Nest runs global guards *before*
   * the controller-level `JwtAuthGuard` — so `req.user` isn't populated yet
   * and has to be resolved here. A bad or missing token is not this guard's
   * problem: it lets the request through for `JwtAuthGuard` to reject, which
   * is safe because this guard only ever *removes* permissions.
   */
  private currentUser(req: Request): AuthUser | null {
    const attached = (req as Request & { user?: AuthUser }).user;
    if (attached) return attached;

    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) return null;
    try {
      const payload = this.jwt.verify<{
        sub: string;
        email: string;
        role: string;
        schoolId: string | null;
      }>(header.slice(7), {
        secret: this.config.get<string>('jwt.secret'),
      });
      return {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        schoolId: payload.schoolId,
      };
    } catch {
      return null;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    if (!WRITE_METHODS.has(req.method)) return true;

    const user = this.currentUser(req);
    // Unauthenticated requests are the other guards' problem.
    if (!user?.schoolId) return true;
    if (user.role === UserRole.SUPER_ADMIN) return true;

    if (
      isAlwaysWritable(
        req.path,
        this.config.get<string>('app.globalPrefix', 'api'),
      )
    ) {
      return true;
    }

    // Lighter than stateFor(): the guard needs the phase, not the invoice.
    const state = await this.subscriptions.guardStateFor(user.schoolId);

    if (user.role === UserRole.ADMIN) {
      if (state.adminReadOnly) {
        // "Subscription" throughout, never "fee" — fees are what parents pay
        // the school, and confusing the two directions of money would be a
        // genuinely expensive misunderstanding.
        throw new ForbiddenException(
          'Your Sproutly subscription has expired. Renew it under Subscription to make changes again.',
        );
      }
      return true;
    }

    if (state.schoolReadOnly) {
      // Deliberately says nothing about billing — a teacher or parent should
      // not be handed the school's payment problems.
      throw new ForbiddenException(
        'This school is temporarily read-only. Please contact the school office.',
      );
    }
    return true;
  }
}
