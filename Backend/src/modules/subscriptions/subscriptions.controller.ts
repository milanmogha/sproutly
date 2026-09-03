import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  type AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionInvoiceStatus } from './schemas/subscription-invoice.schema';
import {
  CreateSubscriptionInvoiceDto,
  RecordSubscriptionPaymentDto,
  VerifySubscriptionPaymentDto,
} from './dto/subscription.dto';

/**
 * The platform's own billing: what a school owes Sproutly for the service.
 *
 * Two audiences in one controller — the super admin raises and settles
 * invoices for any school, the school's admin sees and pays their own. Note
 * these routes stay writable when a school is locked out (see
 * SubscriptionGuard), because paying is how the lock is lifted.
 */
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  // ── School side ─────────────────────────────────────────

  /** The signed-in school's own position: phase, dates, what's outstanding. */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.subscriptions.stateFor(user.schoolId ?? '');
  }

  @Get('mine/invoices')
  myInvoices(@CurrentUser() user: AuthUser) {
    return this.subscriptions.findForSchool(user.schoolId ?? '');
  }

  /** Starts an online payment for one of the school's own invoices. */
  @Post('mine/invoices/:id/checkout')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  checkout(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.subscriptions.createCheckout(id, user.schoolId ?? '');
  }

  /** The client's success callback; the webhook confirms it independently. */
  @Post('mine/payments/verify')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  verify(
    @Body() dto: VerifySubscriptionPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.subscriptions.verifyAndSettle(dto, user.schoolId ?? '');
  }

  // ── Platform side ───────────────────────────────────────

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Query('status') status?: SubscriptionInvoiceStatus) {
    return this.subscriptions.findAll(status);
  }

  /** Every school's billing position — who is active, expiring, or overdue. */
  @Get('overview')
  @Roles(UserRole.SUPER_ADMIN)
  overview() {
    return this.subscriptions.platformOverview();
  }

  @Get('schools/:schoolId')
  @Roles(UserRole.SUPER_ADMIN)
  forSchool(@Param('schoolId') schoolId: string) {
    return this.subscriptions.stateFor(schoolId);
  }

  @Get('schools/:schoolId/invoices')
  @Roles(UserRole.SUPER_ADMIN)
  invoicesForSchool(@Param('schoolId') schoolId: string) {
    return this.subscriptions.findForSchool(schoolId);
  }

  @Post('schools/:schoolId/invoices')
  @Roles(UserRole.SUPER_ADMIN)
  createInvoice(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateSubscriptionInvoiceDto,
  ) {
    return this.subscriptions.createInvoice(schoolId, dto);
  }

  /** Money taken at the SaaS owner's office. */
  @Post('invoices/:id/record-payment')
  @Roles(UserRole.SUPER_ADMIN)
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordSubscriptionPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.subscriptions.recordPayment(id, dto, user.userId);
  }

  @Delete('invoices/:id')
  @Roles(UserRole.SUPER_ADMIN)
  cancel(@Param('id') id: string) {
    return this.subscriptions.cancelInvoice(id);
  }
}
