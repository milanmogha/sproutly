import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { FeeStatus } from '../../common/enums/fee-status.enum';
import { FeeFrequency } from '../../common/enums/fee-frequency.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { buildInstallments } from './utils/fee-installments.util';
import { StudentsService } from '../students/students.service';
import { Student } from '../students/schemas/student.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  FeeStructure,
  FeeStructureDocument,
} from './schemas/fee-structure.schema';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { Receipt, ReceiptDocument } from './schemas/receipt.schema';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { QueryInvoicesDto } from './dto/query-fees.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { SchoolsService } from '../schools/schools.service';
import { RazorpayService } from './razorpay.service';

export interface PaymentResult {
  payment: Payment;
  receipt: Receipt;
  invoice: Invoice;
}

/** So an invoice can be shown as "whose fee is this" without a second lookup. */
const INVOICE_OWNER_POPULATE = [
  { path: 'student', select: 'firstName lastName admissionNumber photoUrl' },
  { path: 'classId', select: 'name section' },
];

@Injectable()
export class FeesService {
  constructor(
    @InjectModel(FeeStructure.name)
    private readonly structureModel: Model<FeeStructureDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Receipt.name)
    private readonly receiptModel: Model<ReceiptDocument>,
    private readonly studentsService: StudentsService,
    private readonly notifications: NotificationsService,
    // Each school pays into its own Razorpay account, so credentials are
    // looked up per school rather than held in config.
    private readonly schoolsService: SchoolsService,
    private readonly razorpay: RazorpayService,
  ) {}

  // ── Fee structures ──────────────────────────────────────

  createStructure(
    dto: CreateFeeStructureDto,
    schoolId: string | null,
  ): Promise<FeeStructure> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const totalAmount = dto.components.reduce((sum, c) => sum + c.amount, 0);
    return this.structureModel.create({ ...dto, totalAmount, schoolId });
  }

  findStructures(schoolId: string | null): Promise<FeeStructure[]> {
    return this.structureModel
      .find(scopeFilter({}, schoolId))
      .sort({ academicYear: -1, name: 1 })
      .exec();
  }

  async findStructure(
    id: string,
    schoolId: string | null,
  ): Promise<FeeStructure> {
    const doc = await this.structureModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) throw new NotFoundException('Fee structure not found');
    return doc;
  }

  async updateStructure(
    id: string,
    dto: UpdateFeeStructureDto,
    schoolId: string | null,
  ): Promise<FeeStructure> {
    const patch: Record<string, unknown> = { ...dto };
    if (dto.components) {
      patch.totalAmount = dto.components.reduce((sum, c) => sum + c.amount, 0);
    }
    const doc = await this.structureModel
      .findOneAndUpdate(scopeFilter({ _id: id }, schoolId), patch, {
        new: true,
        runValidators: true,
      })
      .exec();
    if (!doc) throw new NotFoundException('Fee structure not found');
    return doc;
  }

  async removeStructure(id: string, schoolId: string | null): Promise<void> {
    const res = await this.structureModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) throw new NotFoundException('Fee structure not found');
  }

  // ── Invoices ────────────────────────────────────────────

  async createInvoice(
    dto: CreateInvoiceDto,
    schoolId: string | null,
  ): Promise<Invoice> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const student = await this.studentsService.findOne(
      dto.studentId,
      schoolId,
    );
    const totalAmount = dto.lineItems.reduce((sum, l) => sum + l.amount, 0);
    const invoiceNumber = await this.nextInvoiceNumber(schoolId);

    const invoice = await this.invoiceModel.create({
      schoolId,
      invoiceNumber,
      student: new Types.ObjectId(dto.studentId),
      classId: student.classId ?? null,
      feeStructure: dto.feeStructureId
        ? new Types.ObjectId(dto.feeStructureId)
        : null,
      academicYear: dto.academicYear,
      period: dto.period,
      lineItems: dto.lineItems,
      totalAmount,
      dueDate: new Date(dto.dueDate),
      status: FeeStatus.PENDING,
    });

    await this.notifyInvoiceIssued(
      student,
      { period: dto.period, totalAmount, dueDate: new Date(dto.dueDate) },
      String(invoice._id),
      schoolId,
    );
    return invoice;
  }

  /** Tells a child's parent that a bill is waiting, and what it's for.
   *  Takes only the fields it needs, so a `.populate()`d subset works too. */
  private notifyInvoiceIssued(
    student: Pick<Student, 'firstName' | 'parentUserId'>,
    invoice: { period: string; totalAmount: number; dueDate: Date },
    invoiceId: string,
    schoolId: string,
  ): Promise<number> {
    const parent = student.parentUserId;
    if (!parent) {
      return Promise.resolve(0);
    }
    const amount = invoice.totalAmount.toLocaleString('en-IN');
    const due = invoice.dueDate.toDateString();
    return this.notifications.sendMany(
      [String(parent)],
      {
        title: `Fee invoice for ${student.firstName}`,
        body: `₹${amount} for ${invoice.period} is due by ${due}.`,
        type: 'fee',
        data: { invoiceId, period: invoice.period, dueDate: due },
      },
      schoolId,
      'feeReminders',
    );
  }

  /**
   * Bulk-generates a whole session's invoices for a class, driven by the fee
   * structure's frequency: monthly → 12, quarterly → 4, term → 2, annual → 1.
   * Amounts are per-installment (the structure total is billed on each). Runs
   * are idempotent — an invoice already existing for a (student, structure,
   * period) is skipped, so re-running only fills gaps.
   *
   * Annual invoices notify the parent at generation. Recurring frequencies stay
   * quiet here; their reminders go out on each due date via {@link sendDueReminders}.
   */
  async generateInvoices(
    dto: GenerateInvoicesDto,
    schoolId: string | null,
  ): Promise<{
    created: number;
    skipped: number;
    scheduled: number;
    installments: number;
  }> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const structure = await this.findStructure(dto.feeStructureId, schoolId);
    const roster = await this.studentsService.findByClass(
      dto.classId,
      schoolId,
    );
    const academicYear = dto.academicYear ?? structure.academicYear;
    // Anchored to today: months already gone are skipped, and the rest bill on
    // today's day-of-month. Only the first one is issued now — see below.
    const now = new Date();
    const installments = buildInstallments(
      structure.frequency,
      academicYear,
      structure.dueDayOfMonth,
      now,
    );
    if (installments.length === 0) {
      throw new BadRequestException(
        `The ${academicYear} session is already over — nothing left to bill.`,
      );
    }
    const totalAmount = structure.components.reduce(
      (sum, c) => sum + c.amount,
      0,
    );
    const lineItems = structure.components.map((c) => ({
      name: c.name,
      amount: c.amount,
    }));
    const feeStructureId = new Types.ObjectId(dto.feeStructureId);
    const classId = new Types.ObjectId(dto.classId);

    let created = 0;
    let skipped = 0;
    let scheduled = 0;
    for (const student of roster) {
      const studentId = (student as unknown as { _id: Types.ObjectId })._id;
      for (const inst of installments) {
        const exists = await this.invoiceModel.exists(
          scopeFilter(
            { student: studentId, feeStructure: feeStructureId, period: inst.period },
            schoolId,
          ),
        );
        if (exists) {
          skipped++;
          continue;
        }
        // Only the installment for the current period goes out now; the rest
        // wait for their own month, so a parent isn't handed a year of bills.
        const isLive = inst.issueDate <= now;
        const invoice = await this.invoiceModel.create({
          schoolId,
          invoiceNumber: await this.nextInvoiceNumber(schoolId),
          student: studentId,
          classId,
          feeStructure: feeStructureId,
          academicYear,
          period: inst.period,
          installmentIndex: inst.index,
          lineItems,
          totalAmount,
          dueDate: inst.dueDate,
          issuedAt: inst.issueDate,
          status: isLive ? FeeStatus.PENDING : FeeStatus.SCHEDULED,
        });
        created++;
        if (isLive) {
          await this.notifyInvoiceIssued(
            student,
            { period: inst.period, totalAmount, dueDate: inst.dueDate },
            String(invoice._id),
            schoolId,
          );
        } else {
          scheduled++;
        }
      }
    }
    return {
      created,
      skipped,
      scheduled,
      installments: installments.length,
    };
  }

  // ── Reminders (scheduled) ───────────────────────────────

  /**
   * Daily sweep that pushes fee reminders to parents:
   *  - invoices due today get a one-time "due today" nudge, then
   *  - invoices past their due date are flipped to OVERDUE and get a one-time
   *    overdue nudge.
   * Each reminder is guarded by a timestamp so it is never sent twice. Runs
   * across every school; annual invoices are already reminded at generation.
   */
  /**
   * Flips SCHEDULED invoices to PENDING once their issue date arrives, and
   * tells the parent — this is the moment the bill actually reaches them.
   *
   * Catches up rather than assuming it ran yesterday: it takes everything with
   * an issue date before [cutoff], so a server that was down for a week still
   * releases the right invoices on its next run.
   */
  private async issueScheduledInvoices(
    cutoff: Date,
    populate: { path: string; select: string },
  ): Promise<void> {
    const due = await this.invoiceModel
      .find({ status: FeeStatus.SCHEDULED, issuedAt: { $lt: cutoff } })
      .populate(populate)
      .exec();

    for (const invoice of due) {
      invoice.status = FeeStatus.PENDING;
      await invoice.save();
      await this.notifyInvoiceIssued(
        invoice.student as unknown as Pick<
          Student,
          'firstName' | 'parentUserId'
        >,
        {
          period: invoice.period,
          totalAmount: invoice.totalAmount,
          dueDate: invoice.dueDate,
        },
        String(invoice._id),
        String(invoice.schoolId),
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDueReminders(): Promise<void> {
    const now = new Date();
    const startToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);

    const unpaid = {
      $in: [FeeStatus.PENDING, FeeStatus.PARTIAL, FeeStatus.OVERDUE],
    };
    const reminderPopulate = {
      path: 'student',
      select: 'firstName lastName parentUserId',
    };

    // Release this month's invoices first, so anything issued today is also
    // considered by the due/overdue passes below.
    await this.issueScheduledInvoices(endToday, reminderPopulate);

    const dueToday = await this.invoiceModel
      .find({
        status: unpaid,
        dueDate: { $gte: startToday, $lt: endToday },
        dueReminderSentAt: null,
      })
      .populate(reminderPopulate)
      .exec();
    for (const invoice of dueToday) {
      await this.remindOne(invoice, 'due');
      invoice.dueReminderSentAt = now;
      await invoice.save();
    }

    const overdue = await this.invoiceModel
      .find({
        status: unpaid,
        dueDate: { $lt: startToday },
        overdueReminderSentAt: null,
      })
      .populate(reminderPopulate)
      .exec();
    for (const invoice of overdue) {
      invoice.status = FeeStatus.OVERDUE;
      await this.remindOne(invoice, 'overdue');
      invoice.overdueReminderSentAt = now;
      await invoice.save();
    }
  }

  /** Sends one due/overdue reminder for an invoice (with populated student). */
  private async remindOne(
    invoice: InvoiceDocument,
    kind: 'due' | 'overdue',
  ): Promise<void> {
    const student = invoice.student as unknown as {
      firstName?: string;
      parentUserId?: Types.ObjectId | null;
    } | null;
    if (!student?.parentUserId) return;

    const amountDue = Math.max(0, invoice.totalAmount - invoice.amountPaid);
    const amount = amountDue.toLocaleString('en-IN');
    const due = invoice.dueDate.toDateString();
    const name = student.firstName ?? 'your child';
    const title =
      kind === 'overdue' ? `Overdue fee for ${name}` : `Fee due for ${name}`;
    const body =
      kind === 'overdue'
        ? `₹${amount} for ${invoice.period} was due on ${due}. Please pay at the earliest.`
        : `₹${amount} for ${invoice.period} is due today (${due}).`;

    await this.notifications.sendMany(
      [String(student.parentUserId)],
      {
        title,
        body,
        type: 'fee',
        data: {
          invoiceId: String(invoice._id),
          period: invoice.period,
          dueDate: due,
        },
      },
      String(invoice.schoolId),
      'feeReminders',
    );
  }

  async findInvoices(
    query: QueryInvoicesDto,
    schoolId: string | null,
  ): Promise<PaginatedResult<Invoice>> {
    const { page = 1, limit = 20, status, studentId, classId } = query;
    const filter: FilterQuery<InvoiceDocument> = {};
    if (status) filter.status = status;
    if (studentId) filter.student = new Types.ObjectId(studentId);
    if (classId) filter.classId = new Types.ObjectId(classId);
    scopeFilter(filter, schoolId);

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        // Chronological: this month first, the rest of the session after it,
        // which is the order the school reads a fee ledger in.
        .sort({ dueDate: 1, invoiceNumber: 1 })
        .skip(skip)
        .limit(limit)
        .populate(INVOICE_OWNER_POPULATE)
        .exec(),
      this.invoiceModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findInvoice(id: string, schoolId: string | null): Promise<Invoice> {
    const doc = await this.invoiceModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .populate(INVOICE_OWNER_POPULATE)
      .exec();
    if (!doc) throw new NotFoundException('Invoice not found');
    return doc;
  }

  /**
   * One student's invoices. [includeScheduled] belongs to the school side —
   * the office wants to see the rest of the session laid out, while a parent
   * should only ever see what has actually been billed to them.
   */
  studentInvoices(
    studentId: string,
    schoolId: string | null,
    includeScheduled = false,
  ): Promise<Invoice[]> {
    const filter: FilterQuery<InvoiceDocument> = {
      student: new Types.ObjectId(studentId),
    };
    if (!includeScheduled) {
      filter.status = { $ne: FeeStatus.SCHEDULED };
    }
    return this.invoiceModel
      .find(scopeFilter(filter, schoolId))
      .sort({ issuedAt: -1 })
      .populate(INVOICE_OWNER_POPULATE)
      .exec();
  }

  /** Outstanding invoices (balance > 0), optionally scoped to a student/class. */
  pendingDues(
    studentId: string | undefined,
    classId: string | undefined,
    schoolId: string | null,
  ): Promise<Invoice[]> {
    const filter: FilterQuery<InvoiceDocument> = {
      status: {
        $in: [FeeStatus.PENDING, FeeStatus.PARTIAL, FeeStatus.OVERDUE],
      },
    };
    if (studentId) filter.student = new Types.ObjectId(studentId);
    if (classId) filter.classId = new Types.ObjectId(classId);
    scopeFilter(filter, schoolId);
    return this.invoiceModel
      .find(filter)
      .sort({ dueDate: 1 })
      .populate(INVOICE_OWNER_POPULATE)
      .exec();
  }

  // ── Payments & receipts ─────────────────────────────────

  async recordPayment(
    dto: RecordPaymentDto,
    receivedBy: string,
    schoolId: string | null,
  ): Promise<PaymentResult> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const invoice = await this.invoiceModel
      .findOne(scopeFilter({ _id: dto.invoiceId }, schoolId))
      .exec();
    if (!invoice) throw new NotFoundException('Invoice not found');

    const balance = invoice.totalAmount - invoice.amountPaid;
    if (balance <= 0) {
      throw new ConflictException('Invoice is already settled');
    }
    if (dto.amount > balance) {
      throw new BadRequestException(
        `Amount exceeds outstanding balance (${balance})`,
      );
    }

    const payment = await this.paymentModel.create({
      schoolId,
      paymentNumber: await this.nextNumber(
        this.paymentModel,
        'paymentNumber',
        'PAY',
        schoolId,
      ),
      invoice: invoice._id,
      student: invoice.student,
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference ?? null,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
      receivedBy: new Types.ObjectId(receivedBy),
      note: dto.note ?? null,
    });

    invoice.amountPaid += dto.amount;
    const balanceAfter = invoice.totalAmount - invoice.amountPaid;
    invoice.status = balanceAfter <= 0 ? FeeStatus.PAID : FeeStatus.PARTIAL;
    await invoice.save();

    const receipt = await this.receiptModel.create({
      schoolId,
      receiptNumber: await this.nextNumber(
        this.receiptModel,
        'receiptNumber',
        'RCP',
        schoolId,
      ),
      payment: payment._id,
      invoice: invoice._id,
      student: invoice.student,
      amount: dto.amount,
      balanceAfter,
    });

    return { payment, receipt, invoice };
  }

  // ── Online payment (Razorpay) ───────────────────────────

  /**
   * Opens a Razorpay order for an invoice's outstanding balance and parks a
   * `pending` Payment row against it.
   *
   * The pending row is what makes the flow idempotent: `gatewayOrderId` is
   * uniquely indexed, so the webhook (which may fire more than once) settles
   * exactly one row. Re-opening checkout on an invoice that already has a live
   * order reuses it rather than stacking orders.
   */
  async createCheckout(
    invoiceId: string,
    schoolId: string | null,
    requestedBy: string,
  ): Promise<{
    orderId: string;
    amount: number;
    amountPaise: number;
    currency: string;
    keyId: string;
    invoiceNumber: string;
  }> {
    if (!schoolId) throw new BadRequestException('schoolId is required');

    const invoice = await this.invoiceModel
      .findOne(scopeFilter({ _id: invoiceId }, schoolId))
      .exec();
    if (!invoice) throw new NotFoundException('Invoice not found');

    const balance = invoice.totalAmount - invoice.amountPaid;
    if (balance <= 0) {
      throw new ConflictException('This invoice is already settled');
    }

    const creds = await this.schoolsService.paymentCredentials(schoolId);
    const amountPaise = this.razorpay.toPaise(balance);

    // Reuse a still-open order for the same balance so a parent who backs out
    // of checkout and returns doesn't leave a trail of orphan orders.
    const existing = await this.paymentModel
      .findOne({
        schoolId: new Types.ObjectId(schoolId),
        invoice: invoice._id,
        status: 'pending',
        amount: balance,
      })
      .exec();
    if (existing?.gatewayOrderId) {
      return {
        orderId: existing.gatewayOrderId,
        amount: balance,
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
      // Echoed back on the webhook — a second way to identify the invoice if
      // the pending row is ever missing.
      notes: {
        invoiceId: String(invoice._id),
        schoolId,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    await this.paymentModel.create({
      schoolId,
      paymentNumber: await this.nextNumber(
        this.paymentModel,
        'paymentNumber',
        'PAY',
        schoolId,
      ),
      invoice: invoice._id,
      student: invoice.student,
      amount: balance,
      method: PaymentMethod.ONLINE,
      status: 'pending',
      gateway: 'razorpay',
      gatewayOrderId: order.id,
      receivedBy: new Types.ObjectId(requestedBy),
      note: 'Online payment started',
    });

    return {
      orderId: order.id,
      amount: balance,
      amountPaise,
      currency: 'INR',
      keyId: creds.keyId,
      invoiceNumber: invoice.invoiceNumber,
    };
  }

  /**
   * Settles a pending online payment. Called by the webhook (authoritative)
   * and by the client's success callback (a best-effort head start so the app
   * updates immediately); whichever lands first does the work and the other
   * becomes a no-op.
   *
   * The `status: 'pending'` in the update filter is the concurrency guard —
   * only one caller can flip the row, so the invoice can't be credited twice.
   */
  async settleGatewayPayment(params: {
    schoolId: string;
    orderId: string;
    gatewayPaymentId: string;
  }): Promise<PaymentResult | null> {
    const claimed = await this.paymentModel
      .findOneAndUpdate(
        {
          schoolId: new Types.ObjectId(params.schoolId),
          gatewayOrderId: params.orderId,
          status: 'pending',
        },
        {
          $set: {
            status: 'success',
            gatewayPaymentId: params.gatewayPaymentId,
            paidAt: new Date(),
            note: 'Paid online',
          },
        },
        { new: true },
      )
      .exec();

    // Already settled (webhook retry, or the client beat us to it).
    if (!claimed) return null;

    const invoice = await this.invoiceModel
      .findOne(
        scopeFilter({ _id: claimed.invoice }, params.schoolId),
      )
      .exec();
    if (!invoice) {
      throw new NotFoundException('Invoice not found for this payment');
    }

    invoice.amountPaid += claimed.amount;
    const balanceAfter = invoice.totalAmount - invoice.amountPaid;
    invoice.status = balanceAfter <= 0 ? FeeStatus.PAID : FeeStatus.PARTIAL;
    await invoice.save();

    const receipt = await this.receiptModel.create({
      schoolId: params.schoolId,
      receiptNumber: await this.nextNumber(
        this.receiptModel,
        'receiptNumber',
        'RCP',
        params.schoolId,
      ),
      payment: claimed._id,
      invoice: invoice._id,
      student: invoice.student,
      amount: claimed.amount,
      balanceAfter,
    });

    return { payment: claimed, receipt, invoice };
  }

  /**
   * Verifies the client's success callback and settles on the strength of it.
   * The signature proves the client isn't making the payment up; the webhook
   * still arrives and finds the row already settled.
   */
  async verifyAndSettle(
    dto: VerifyPaymentDto,
    schoolId: string | null,
  ): Promise<{ settled: boolean; invoice: Invoice | null }> {
    if (!schoolId) throw new BadRequestException('schoolId is required');

    const creds = await this.schoolsService.paymentCredentials(schoolId);
    const valid = this.razorpay.verifyCheckoutSignature({
      keySecret: creds.keySecret,
      orderId: dto.razorpayOrderId,
      paymentId: dto.razorpayPaymentId,
      signature: dto.razorpaySignature,
    });
    if (!valid) {
      throw new BadRequestException('Payment signature could not be verified');
    }

    const result = await this.settleGatewayPayment({
      schoolId,
      orderId: dto.razorpayOrderId,
      gatewayPaymentId: dto.razorpayPaymentId,
    });

    // `null` means the webhook got there first — still a success for the
    // caller, so report the invoice as it now stands.
    if (!result) {
      const payment = await this.paymentModel
        .findOne({
          schoolId: new Types.ObjectId(schoolId),
          gatewayOrderId: dto.razorpayOrderId,
        })
        .exec();
      const invoice = payment
        ? await this.invoiceModel.findById(payment.invoice).exec()
        : null;
      return { settled: true, invoice };
    }

    return { settled: true, invoice: result.invoice };
  }

  /** Marks a started-but-failed attempt so it stops blocking a fresh order. */
  async failGatewayPayment(schoolId: string, orderId: string): Promise<void> {
    await this.paymentModel
      .findOneAndUpdate(
        {
          schoolId: new Types.ObjectId(schoolId),
          gatewayOrderId: orderId,
          status: 'pending',
        },
        { $set: { status: 'failed', note: 'Payment failed at the gateway' } },
      )
      .exec();
  }

  invoicePayments(
    invoiceId: string,
    schoolId: string | null,
  ): Promise<Payment[]> {
    return this.paymentModel
      .find(scopeFilter({ invoice: new Types.ObjectId(invoiceId) }, schoolId))
      .sort({ paidAt: -1 })
      .exec();
  }

  async getReceipt(id: string, schoolId: string | null): Promise<Receipt> {
    const doc = await this.receiptModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) throw new NotFoundException('Receipt not found');
    return doc;
  }

  // ── Reports ─────────────────────────────────────────────

  async collectionSummary(
    from: string | undefined,
    to: string | undefined,
    schoolId: string | null,
  ) {
    const match: FilterQuery<PaymentDocument> = {};
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      match.paidAt = range;
    }
    if (schoolId) {
      match.schoolId = new Types.ObjectId(schoolId);
    }

    const [totals, byMethod] = await Promise.all([
      this.paymentModel
        .aggregate<{ total: number; count: number }>([
          { $match: match },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.paymentModel
        .aggregate<{ _id: string; total: number }>([
          { $match: match },
          { $group: { _id: '$method', total: { $sum: '$amount' } } },
        ])
        .exec(),
    ]);

    return {
      from: from ?? null,
      to: to ?? null,
      totalCollected: totals[0]?.total ?? 0,
      paymentCount: totals[0]?.count ?? 0,
      byMethod: Object.fromEntries(byMethod.map((m) => [m._id, m.total])),
    };
  }

  async outstandingSummary(schoolId: string | null) {
    const match: FilterQuery<InvoiceDocument> = {
      status: {
        $in: [FeeStatus.PENDING, FeeStatus.PARTIAL, FeeStatus.OVERDUE],
      },
    };
    if (schoolId) {
      match.schoolId = new Types.ObjectId(schoolId);
    }

    const rows = await this.invoiceModel
      .aggregate<{ total: number; paid: number; count: number }>([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
            paid: { $sum: '$amountPaid' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const agg = rows[0];
    return {
      outstandingInvoices: agg?.count ?? 0,
      totalOutstanding: agg ? agg.total - agg.paid : 0,
    };
  }

  // ── number generators ───────────────────────────────────

  private async nextInvoiceNumber(schoolId: string): Promise<string> {
    return this.nextNumber(this.invoiceModel, 'invoiceNumber', 'INV', schoolId);
  }

  private async nextNumber(
    model:
      Model<InvoiceDocument> | Model<PaymentDocument> | Model<ReceiptDocument>,
    field: 'invoiceNumber' | 'paymentNumber' | 'receiptNumber',
    prefix: string,
    schoolId: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const p = `${prefix}-${year}-`;
    const last = await (model as Model<InvoiceDocument>)
      .findOne({
        schoolId,
        [field]: new RegExp(`^${p}`),
      } as FilterQuery<InvoiceDocument>)
      .sort({ [field]: -1 })
      .select(field)
      .lean<Record<string, string>>()
      .exec();

    const lastSeq = last ? parseInt(last[field].slice(p.length), 10) || 0 : 0;
    return `${p}${String(lastSeq + 1).padStart(5, '0')}`;
  }
}
