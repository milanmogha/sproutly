import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { RazorpayService } from '../fees/razorpay.service';
import { SchoolsService } from '../schools/schools.service';
import { School } from '../schools/schemas/school.schema';
import {
  SubscriptionInvoice,
  SubscriptionInvoiceDocument,
  SubscriptionInvoiceStatus,
} from './schemas/subscription-invoice.schema';
import {
  CreateSubscriptionInvoiceDto,
  RecordSubscriptionPaymentDto,
  VerifySubscriptionPaymentDto,
} from './dto/subscription.dto';
import {
  addDays,
  renewalStart,
  startOfDay,
  subscriptionState,
  SubscriptionState,
  WARN_BEFORE_DAYS,
} from './subscription-policy';

/** One school's line on the platform billing screen. */
export interface PlatformBillingRow extends SubscriptionState {
  school: { id: string; name: string; code: string };
  outstanding: SubscriptionInvoice | null;
}

/**
 * What starting a payment produced.
 *
 * Two outcomes, because not every invoice needs a gateway: a zero-amount
 * invoice is a free period and is activated on the spot. Clients must branch
 * on `settled` rather than assume an order is coming back.
 */
export type SubscriptionCheckoutResult =
  | { settled: true; invoiceNumber: string; periodEnd: Date }
  | {
      settled: false;
      orderId: string;
      amount: number;
      amountPaise: number;
      currency: string;
      keyId: string;
      invoiceNumber: string;
    };

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel(SubscriptionInvoice.name)
    private readonly invoiceModel: Model<SubscriptionInvoiceDocument>,
    private readonly razorpay: RazorpayService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly usersService: UsersService,
    private readonly schools: SchoolsService,
  ) {}

  // ── Platform gateway credentials ────────────────────────
  //
  // This money goes to the PLATFORM, not a school, so unlike fees the keys
  // come from env and there is exactly one account.

  private platformCredentials(): { keyId: string; keySecret: string } {
    const keyId = this.config.get<string>('billing.razorpayKeyId', '');
    const keySecret = this.config.get<string>('billing.razorpayKeySecret', '');
    if (!keyId || !keySecret) {
      throw new BadRequestException(
        'Online subscription payments are not configured on this server',
      );
    }
    return { keyId, keySecret };
  }

  webhookSecret(): string {
    return this.config.get<string>('billing.razorpayWebhookSecret', '');
  }

  isGatewayConfigured(): boolean {
    return Boolean(
      this.config.get<string>('billing.razorpayKeyId', '') &&
        this.config.get<string>('billing.razorpayKeySecret', ''),
    );
  }

  // ── State ───────────────────────────────────────────────

  /**
   * Rejects a caller with no school before it reaches Mongo.
   *
   * `user.schoolId` is null for the super admin, and the controllers pass it
   * through as `''` — which `new Types.ObjectId('')` turns into a 500 rather
   * than anything useful. The super admin has no subscription of their own;
   * they use the platform-side routes instead.
   */
  private schoolObjectId(schoolId: string): Types.ObjectId {
    if (!schoolId || !Types.ObjectId.isValid(schoolId)) {
      throw new BadRequestException(
        'This account does not belong to a school, so it has no subscription',
      );
    }
    return new Types.ObjectId(schoolId);
  }

  /** End of the school's latest paid period, or null if never billed. */
  private async currentPeriodEnd(schoolId: string): Promise<Date | null> {
    const latest = await this.invoiceModel
      .findOne({
        schoolId: this.schoolObjectId(schoolId),
        status: SubscriptionInvoiceStatus.PAID,
      })
      .sort({ periodEnd: -1 })
      .select('periodEnd')
      .exec();
    return latest?.periodEnd ?? null;
  }

  /**
   * Just enough for the guard to decide, cached briefly.
   *
   * The guard runs on **every write in the system**, so hitting Mongo each
   * time would put a query in front of every save the school makes. The phase
   * only changes at a date boundary or when an invoice is paid, so a short
   * cache costs nothing in correctness — and paying an invoice clears it, so
   * an unlock is felt immediately rather than up to a minute later.
   */
  private readonly stateCache = new Map<
    string,
    { at: number; state: SubscriptionState }
  >();
  private static readonly STATE_TTL_MS = 60_000;

  async guardStateFor(schoolId: string): Promise<SubscriptionState> {
    const hit = this.stateCache.get(schoolId);
    if (hit && Date.now() - hit.at < SubscriptionsService.STATE_TTL_MS) {
      return hit.state;
    }
    // Never let a lookup failure *create* a restriction — this runs in front of
    // every write in the system, so it fails open by design.
    if (!Types.ObjectId.isValid(schoolId)) return subscriptionState(null);
    const state = subscriptionState(await this.currentPeriodEnd(schoolId));
    this.stateCache.set(schoolId, { at: Date.now(), state });
    return state;
  }

  private clearStateCache(schoolId: string): void {
    this.stateCache.delete(schoolId);
  }

  /**
   * Where a school stands, plus the invoice it needs to settle. This is what
   * the guard consults on every write and what the billing screens render.
   */
  async stateFor(schoolId: string): Promise<
    SubscriptionState & {
      outstanding: SubscriptionInvoice | null;
      gatewayAvailable: boolean;
    }
  > {
    const schoolObjectId = this.schoolObjectId(schoolId);
    const [periodEnd, outstanding] = await Promise.all([
      this.currentPeriodEnd(schoolId),
      this.invoiceModel
        .findOne({
          schoolId: schoolObjectId,
          status: SubscriptionInvoiceStatus.PENDING,
        })
        .sort({ issuedAt: 1 })
        .exec(),
    ]);
    return {
      ...subscriptionState(periodEnd),
      outstanding,
      gatewayAvailable: this.isGatewayConfigured(),
    };
  }

  // ── Invoicing (super admin) ─────────────────────────────

  /**
   * Raises the next invoice for a school. The dates written here are
   * provisional: paying early or late shifts the window, so they're recomputed
   * at settlement (see {@link settle}).
   */
  async createInvoice(
    schoolId: string,
    dto: CreateSubscriptionInvoiceDto,
  ): Promise<SubscriptionInvoice> {
    const outstanding = await this.invoiceModel
      .findOne({
        schoolId: this.schoolObjectId(schoolId),
        status: SubscriptionInvoiceStatus.PENDING,
      })
      .exec();
    if (outstanding) {
      throw new ConflictException(
        `This school already has an unpaid invoice (${outstanding.invoiceNumber}). Cancel it before raising another.`,
      );
    }

    const previousEnd = await this.currentPeriodEnd(schoolId);
    const periodStart = renewalStart(previousEnd);
    return this.invoiceModel.create({
      schoolId,
      invoiceNumber: await this.nextInvoiceNumber(),
      amount: dto.amount,
      durationDays: dto.durationDays,
      durationLabel: dto.durationLabel ?? null,
      periodStart,
      periodEnd: addDays(periodStart, dto.durationDays),
      notes: dto.notes ?? null,
      status: SubscriptionInvoiceStatus.PENDING,
    });
  }

  findForSchool(schoolId: string): Promise<SubscriptionInvoice[]> {
    return this.invoiceModel
      .find({ schoolId: this.schoolObjectId(schoolId) })
      .sort({ issuedAt: -1 })
      .exec();
  }

  /**
   * Every school's billing position on one screen.
   *
   * Deliberately built from three fixed queries rather than one per school:
   * the SaaS owner's whole job here is spotting who is about to lapse, and
   * that page should not get slower as schools are added.
   *
   * Schools that have never been billed are included — they're precisely the
   * ones the owner needs to notice.
   */
  async platformOverview(): Promise<PlatformBillingRow[]> {
    const [schools, latestPaid, pending] = await Promise.all([
      this.allSchools(),
      this.invoiceModel
        .aggregate<{ _id: Types.ObjectId; periodEnd: Date }>([
          { $match: { status: SubscriptionInvoiceStatus.PAID } },
          { $sort: { periodEnd: -1 } },
          { $group: { _id: '$schoolId', periodEnd: { $first: '$periodEnd' } } },
        ])
        .exec(),
      this.invoiceModel
        .find({ status: SubscriptionInvoiceStatus.PENDING })
        .sort({ issuedAt: 1 })
        .exec(),
    ]);

    const endBySchool = new Map(
      latestPaid.map((r) => [String(r._id), r.periodEnd]),
    );
    // createInvoice allows only one pending invoice per school, so first wins.
    const pendingBySchool = new Map<string, SubscriptionInvoice>();
    for (const inv of pending) {
      const key = String(inv.schoolId);
      if (!pendingBySchool.has(key)) pendingBySchool.set(key, inv);
    }

    return schools.map((school) => ({
      school,
      ...subscriptionState(endBySchool.get(school.id) ?? null),
      outstanding: pendingBySchool.get(school.id) ?? null,
    }));
  }

  /** Every school, id/name/code only — paged because the API caps `limit`. */
  private async allSchools(): Promise<
    { id: string; name: string; code: string }[]
  > {
    const out: { id: string; name: string; code: string }[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const res = await this.schools.findAll({ page, limit: 100 });
      out.push(
        ...res.data.map((s) => {
          const doc = s as School & { _id: Types.ObjectId };
          return { id: String(doc._id), name: doc.name, code: doc.code };
        }),
      );
      if (page >= res.totalPages) break;
    }
    return out;
  }

  /** Every school's billing position, for the platform overview. */
  async findAll(status?: SubscriptionInvoiceStatus) {
    const filter: FilterQuery<SubscriptionInvoiceDocument> = {};
    if (status) filter.status = status;
    return this.invoiceModel
      .find(filter)
      .sort({ issuedAt: -1 })
      .populate({ path: 'schoolId', select: 'name code' })
      .exec();
  }

  async cancelInvoice(id: string): Promise<SubscriptionInvoice> {
    const doc = await this.invoiceModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Invoice not found');
    if (doc.status === SubscriptionInvoiceStatus.PAID) {
      throw new ConflictException('A paid invoice cannot be cancelled');
    }
    doc.status = SubscriptionInvoiceStatus.CANCELLED;
    await doc.save();
    return doc;
  }

  // ── Settlement ──────────────────────────────────────────

  /**
   * Marks an invoice paid and fixes its period.
   *
   * The window is computed here rather than at creation because it depends on
   * *when* the money arrived — see {@link renewalStart} for the rule. Guarded
   * on `status: PENDING` so a webhook retry can't extend a school twice.
   */
  private async settle(
    filter: FilterQuery<SubscriptionInvoiceDocument>,
    payment: {
      /** Null when nothing was actually paid — see {@link activateFree}. */
      method: PaymentMethod | null;
      paidAt: Date;
      reference?: string | null;
      recordedBy?: string | null;
      gatewayPaymentId?: string | null;
    },
  ): Promise<SubscriptionInvoice | null> {
    const invoice = await this.invoiceModel
      .findOne({ ...filter, status: SubscriptionInvoiceStatus.PENDING })
      .exec();
    if (!invoice) return null;

    const previousEnd = await this.currentPeriodEnd(String(invoice.schoolId));
    const periodStart = renewalStart(previousEnd, payment.paidAt);

    const claimed = await this.invoiceModel
      .findOneAndUpdate(
        { _id: invoice._id, status: SubscriptionInvoiceStatus.PENDING },
        {
          $set: {
            status: SubscriptionInvoiceStatus.PAID,
            paidAt: payment.paidAt,
            method: payment.method,
            reference: payment.reference ?? null,
            recordedBy: payment.recordedBy
              ? new Types.ObjectId(payment.recordedBy)
              : null,
            periodStart,
            periodEnd: addDays(periodStart, invoice.durationDays),
            ...(payment.gatewayPaymentId
              ? {
                  gatewayStatus: 'success',
                  gatewayPaymentId: payment.gatewayPaymentId,
                }
              : {}),
          },
        },
        { new: true },
      )
      .exec();

    if (claimed) {
      // Drop the cached phase so an unlock takes effect on the next request
      // rather than whenever the TTL happens to lapse.
      this.clearStateCache(String(claimed.schoolId));
      await this.notifyAdmins(
        String(claimed.schoolId),
        'Subscription renewed',
        `Your plan is active until ${claimed.periodEnd.toDateString()}.`,
      );
    }
    return claimed;
  }

  /** The super admin took the money at the office. */
  async recordPayment(
    id: string,
    dto: RecordSubscriptionPaymentDto,
    recordedBy: string,
  ): Promise<SubscriptionInvoice> {
    const settled = await this.settle(
      { _id: new Types.ObjectId(id) },
      {
        method: dto.method ?? PaymentMethod.CASH,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        reference: dto.reference,
        recordedBy,
      },
    );
    if (!settled) {
      throw new ConflictException('Invoice is not pending — nothing to settle');
    }
    return settled;
  }

  // ── Online payment ──────────────────────────────────────

  /**
   * Starts settling an invoice — usually by opening a Razorpay order against
   * the platform's own account.
   *
   * A zero-amount invoice is how a free period is granted, and there is
   * nothing for a gateway to collect, so it is activated on the spot instead
   * (see {@link activateFree}). Callers branch on `settled`.
   */
  async createCheckout(
    invoiceId: string,
    schoolId: string,
  ): Promise<SubscriptionCheckoutResult> {
    const invoice = await this.invoiceModel
      .findOne({
        _id: new Types.ObjectId(invoiceId),
        schoolId: this.schoolObjectId(schoolId),
      })
      .exec();
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== SubscriptionInvoiceStatus.PENDING) {
      throw new ConflictException('This invoice is already settled');
    }

    if (invoice.amount <= 0) {
      return this.activateFree(invoice);
    }

    const creds = this.platformCredentials();
    const amountPaise = this.razorpay.toPaise(invoice.amount);

    // Reuse a live order so backing out of checkout doesn't strand orders.
    if (invoice.gatewayOrderId && invoice.gatewayStatus === 'pending') {
      return {
        settled: false,
        orderId: invoice.gatewayOrderId,
        amount: invoice.amount,
        amountPaise,
        currency: 'INR',
        keyId: creds.keyId,
        invoiceNumber: invoice.invoiceNumber,
      };
    }

    const order = await this.razorpay.createOrder({
      keyId: creds.keyId,
      keySecret: creds.keySecret,
      amountPaise,
      receipt: invoice.invoiceNumber,
      notes: {
        subscriptionInvoiceId: String(invoice._id),
        schoolId,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    invoice.gatewayOrderId = order.id;
    invoice.gatewayStatus = 'pending';
    await invoice.save();

    return {
      settled: false,
      orderId: order.id,
      amount: invoice.amount,
      amountPaise,
      currency: 'INR',
      keyId: creds.keyId,
      invoiceNumber: invoice.invoiceNumber,
    };
  }

  /**
   * Activates a free period — a zero-amount invoice.
   *
   * The super admin raises one of these to grant a trial or a goodwill
   * extension. There is no money to move, so no gateway is involved and the
   * school activating it isn't waiving anything: the platform already decided
   * it was free by setting the amount to zero.
   *
   * `method` stays null because nothing was paid; the period is computed by
   * the same {@link renewalStart} rule as any other settlement, so a free
   * stretch added early still starts where the current one ends.
   */
  private async activateFree(
    invoice: SubscriptionInvoiceDocument,
  ): Promise<SubscriptionCheckoutResult> {
    const granted = await this.settle(
      { _id: invoice._id },
      { method: null, paidAt: new Date() },
    );
    if (!granted) {
      // Something settled it between the status check and here.
      throw new ConflictException('This invoice is already settled');
    }
    return {
      settled: true,
      invoiceNumber: granted.invoiceNumber,
      periodEnd: granted.periodEnd,
    };
  }

  /** Verifies the client's success callback, then settles. */
  async verifyAndSettle(
    dto: VerifySubscriptionPaymentDto,
    schoolId: string,
  ): Promise<{ settled: boolean }> {
    const creds = this.platformCredentials();
    const valid = this.razorpay.verifyCheckoutSignature({
      keySecret: creds.keySecret,
      orderId: dto.razorpayOrderId,
      paymentId: dto.razorpayPaymentId,
      signature: dto.razorpaySignature,
    });
    if (!valid) {
      throw new BadRequestException('Payment signature could not be verified');
    }
    await this.settleByOrder(dto.razorpayOrderId, dto.razorpayPaymentId);
    return { settled: true };
  }

  /** Called by the webhook (authoritative) and the client callback alike. */
  async settleByOrder(
    orderId: string,
    gatewayPaymentId: string,
  ): Promise<SubscriptionInvoice | null> {
    return this.settle(
      { gatewayOrderId: orderId },
      {
        method: PaymentMethod.ONLINE,
        paidAt: new Date(),
        reference: gatewayPaymentId,
        gatewayPaymentId,
      },
    );
  }

  async failByOrder(orderId: string): Promise<void> {
    await this.invoiceModel
      .findOneAndUpdate(
        { gatewayOrderId: orderId, status: SubscriptionInvoiceStatus.PENDING },
        { $set: { gatewayStatus: 'failed' } },
      )
      .exec();
  }

  // ── Expiry reminders ────────────────────────────────────

  /**
   * Nudges school admins whose plan is within the warning window or already
   * past it. Runs daily; the phase itself is what gates the message, so a
   * missed day just means the next run catches up.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendExpiryReminders(): Promise<void> {
    const soon = addDays(startOfDay(new Date()), WARN_BEFORE_DAYS);
    const ending = await this.invoiceModel
      .find({
        status: SubscriptionInvoiceStatus.PAID,
        periodEnd: { $lte: soon },
      })
      .sort({ periodEnd: -1 })
      .exec();

    // One school may have several paid invoices; only its latest matters.
    const latestBySchool = new Map<string, SubscriptionInvoice>();
    for (const inv of ending) {
      const key = String(inv.schoolId);
      if (!latestBySchool.has(key)) latestBySchool.set(key, inv);
    }

    for (const [schoolId, invoice] of latestBySchool) {
      const state = subscriptionState(invoice.periodEnd);
      if (!state.showWarning) continue;

      // Don't nudge a school that has already lined up its next period — a
      // pending (raised but unpaid) invoice, or an already-paid future one.
      // Either extends coverage past the invoice about to end, so there is
      // nothing to renew and the reminder would only be noise.
      const hasNext = await this.invoiceModel.exists({
        schoolId: invoice.schoolId,
        status: {
          $in: [
            SubscriptionInvoiceStatus.PAID,
            SubscriptionInvoiceStatus.PENDING,
          ],
        },
        periodEnd: { $gt: invoice.periodEnd },
      });
      if (hasNext) continue;

      const days = state.daysRemaining ?? 0;
      const message =
        days >= 0
          ? `Your subscription ends in ${days} day${days === 1 ? '' : 's'}. Contact us to renew.`
          : `Your subscription expired ${-days} day${days === -1 ? '' : 's'} ago. Contact us to renew.`;
      await this.notifyAdmins(schoolId, 'Subscription renewal', message);
    }
  }

  /** Subscription messaging is for the admin only — nobody else is told. */
  private async notifyAdmins(
    schoolId: string,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      const admins = await this.usersService.findAll(1, 50, schoolId);
      const ids = admins.data
        .filter((u) => (u as unknown as { role: string }).role === UserRole.ADMIN)
        .map((u) => String((u as unknown as { _id: unknown })._id));
      if (ids.length === 0) return;
      await this.notifications.sendMany(
        ids,
        { title, body, type: 'system', data: { kind: 'subscription' } },
        schoolId,
      );
    } catch (err) {
      this.logger.warn(
        `Could not notify admins of ${schoolId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** `SUB-2026-00001`, unique across the platform (not per school). */
  private async nextInvoiceNumber(): Promise<string> {
    const prefix = `SUB-${new Date().getFullYear()}-`;
    const last = await this.invoiceModel
      .findOne({ invoiceNumber: new RegExp(`^${prefix}`) })
      .sort({ invoiceNumber: -1 })
      .select('invoiceNumber')
      .lean<{ invoiceNumber: string }>()
      .exec();
    const seq = last
      ? parseInt(last.invoiceNumber.slice(prefix.length), 10) || 0
      : 0;
    return `${prefix}${String(seq + 1).padStart(5, '0')}`;
  }
}
