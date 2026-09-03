import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../../common/enums/user-role.enum';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { FeeStatus } from '../../../common/enums/fee-status.enum';
import { Invoice, InvoiceDocument } from '../schemas/invoice.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { Receipt, ReceiptDocument } from '../schemas/receipt.schema';
import { SchoolsService } from '../../schools/schools.service';
import {
  allocatePaid,
  formatAddress,
  paymentModeLabel,
  pickGuardian,
  totalsFor,
  type FeeReceiptData,
} from './fee-receipt.model';
import { renderFeeReceipt } from './fee-receipt.pdf';

/** What the populated references actually look like once fetched. */
interface PopulatedStudent {
  _id: Types.ObjectId;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  admissionNumber?: string;
  parentUserId?: Types.ObjectId | null;
  guardians?: { name: string; relationship?: string; isPrimary?: boolean }[];
}

interface PopulatedClass {
  displayName?: string;
  name?: string;
  section?: string;
}

@Injectable()
export class FeeDocumentService {
  constructor(
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Receipt.name)
    private readonly receiptModel: Model<ReceiptDocument>,
    private readonly schoolsService: SchoolsService,
  ) {}

  /** `Fee-Receipt-INV-2026-00004.pdf` — safe on every filesystem. */
  fileName(data: FeeReceiptData): string {
    const kind = data.kind === 'receipt' ? 'Fee-Receipt' : 'Fee-Invoice';
    const suffix = data.documentNumber.replace(/[^A-Za-z0-9._-]+/g, '-');
    return `${kind}-${suffix}.pdf`;
  }

  async renderInvoice(
    invoiceId: string,
    user: AuthUser,
  ): Promise<{ pdf: Buffer; fileName: string }> {
    const data = await this.buildInvoiceData(invoiceId, user);
    return { pdf: await renderFeeReceipt(data), fileName: this.fileName(data) };
  }

  /**
   * Gathers everything the receipt prints.
   *
   * Access is checked here rather than at the controller because a rendered
   * receipt carries a child's name, guardian, admission number and fee
   * history — considerably more than the JSON row it is built from, and worth
   * a tighter check than "same school".
   */
  async buildInvoiceData(
    invoiceId: string,
    user: AuthUser,
  ): Promise<FeeReceiptData> {
    if (!Types.ObjectId.isValid(invoiceId)) {
      throw new NotFoundException('Invoice not found');
    }

    const filter: Record<string, unknown> = { _id: new Types.ObjectId(invoiceId) };
    // The super admin has no school of their own and may look at any.
    if (user.schoolId) filter.schoolId = new Types.ObjectId(user.schoolId);

    const invoice = await this.invoiceModel
      .findOne(filter)
      .populate<{ student: PopulatedStudent }>({
        path: 'student',
        select: 'firstName lastName fullName admissionNumber parentUserId guardians',
      })
      .populate<{ classId: PopulatedClass }>({
        path: 'classId',
        select: 'name section',
      })
      .exec();

    if (!invoice) throw new NotFoundException('Invoice not found');

    const student = invoice.student as unknown as PopulatedStudent;

    // A parent may only ever pull their own child's document. Without this a
    // parent could walk invoice ids and collect every family's fee records.
    if (user.role === UserRole.PARENT) {
      if (String(student?.parentUserId ?? '') !== String(user.userId)) {
        throw new ForbiddenException('This invoice belongs to another student');
      }
      // A scheduled invoice hasn't been billed yet; the parent shouldn't be
      // able to download something they haven't been asked to pay.
      if (invoice.status === FeeStatus.SCHEDULED) {
        throw new NotFoundException('Invoice not found');
      }
    }

    const schoolId = String(invoice.schoolId);
    const [school, payments, receipts] = await Promise.all([
      this.schoolsService.findOne(schoolId),
      this.paymentModel
        .find({ invoice: invoice._id, status: 'success' })
        .sort({ paidAt: 1 })
        .exec(),
      this.receiptModel
        .find({ invoice: invoice._id })
        .sort({ issuedAt: 1 })
        .exec(),
    ]);

    const lines = allocatePaid(
      invoice.lineItems.map((l) => ({ name: l.name, amount: l.amount })),
      invoice.amountPaid,
    );
    const totals = totalsFor(lines);

    // Anything actually settled prints as a receipt; an open invoice prints as
    // an invoice, so a parent can download the demand before paying it.
    const settled = invoice.amountPaid > 0;
    const latestReceipt = receipts.at(-1);
    const guardian = pickGuardian(student?.guardians ?? []);
    const cls = invoice.classId as unknown as PopulatedClass | null;

    return {
      kind: settled ? 'receipt' : 'invoice',
      // A receipt quotes its receipt number, an unpaid invoice its own.
      documentNumber:
        settled && latestReceipt
          ? latestReceipt.receiptNumber
          : invoice.invoiceNumber,
      academicYear: invoice.academicYear,
      date: settled
        ? (payments.at(-1)?.paidAt ?? invoice.issuedAt)
        : invoice.issuedAt,
      school: {
        trustName: school.trustName ?? null,
        name: school.name,
        address: formatAddress(school.address),
        contactPhone: school.contactPhone ?? null,
        contactEmail: school.contactEmail ?? null,
        website: school.website ?? null,
        affiliationNumber: school.affiliationNumber ?? null,
      },
      student: {
        name:
          student?.fullName ??
          [student?.firstName, student?.lastName].filter(Boolean).join(' '),
        guardianName: guardian.name,
        guardianLabel: guardian.label,
        className:
          cls?.displayName ??
          (cls?.name ? `${cls.name} - ${cls.section ?? ''}`.trim() : null),
        admissionNumber: student?.admissionNumber ?? null,
      },
      lines,
      payments: payments.map((p) => ({
        mode: paymentModeLabel(p.method),
        // No bank is recorded against a payment; the column stays for layout
        // parity with the school's own receipt, which also leaves it blank.
        bank: null,
        number: p.reference ?? p.gatewayPaymentId ?? null,
        date: p.paidAt,
        amount: p.amount,
      })),
      totals,
      generatedAt: new Date(),
    };
  }
}
