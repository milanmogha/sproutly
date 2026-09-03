import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  type AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { FeesService } from './fees.service';
import { FeeDocumentService } from './documents/fee-document.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { QueryInvoicesDto, ReportRangeDto } from './dto/query-fees.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

// Finance roles allowed to manage fees.
const FINANCE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTANT,
] as const;

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeesController {
  constructor(
    private readonly feesService: FeesService,
    private readonly feeDocuments: FeeDocumentService,
  ) {}

  // ── Fee structures ──────────────────────────────────────

  @Post('structures')
  @Roles(...FINANCE_ROLES)
  createStructure(
    @Body() dto: CreateFeeStructureDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.createStructure(dto, user.schoolId);
  }

  @Get('structures')
  findStructures(@CurrentUser() user: AuthUser) {
    return this.feesService.findStructures(user.schoolId);
  }

  @Get('structures/:id')
  findStructure(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.feesService.findStructure(id, user.schoolId);
  }

  @Patch('structures/:id')
  @Roles(...FINANCE_ROLES)
  updateStructure(
    @Param('id') id: string,
    @Body() dto: UpdateFeeStructureDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.updateStructure(id, dto, user.schoolId);
  }

  @Delete('structures/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  removeStructure(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.feesService.removeStructure(id, user.schoolId);
  }

  // ── Invoices ────────────────────────────────────────────

  @Post('invoices')
  @Roles(...FINANCE_ROLES)
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.feesService.createInvoice(dto, user.schoolId);
  }

  @Post('invoices/generate')
  @Roles(...FINANCE_ROLES)
  generateInvoices(
    @Body() dto: GenerateInvoicesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.generateInvoices(dto, user.schoolId);
  }

  @Get('invoices')
  findInvoices(@Query() query: QueryInvoicesDto, @CurrentUser() user: AuthUser) {
    return this.feesService.findInvoices(query, user.schoolId);
  }

  @Get('invoices/:id')
  findInvoice(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.feesService.findInvoice(id, user.schoolId);
  }

  @Get('invoices/:id/payments')
  invoicePayments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.feesService.invoicePayments(id, user.schoolId);
  }

  /**
   * The printable fee receipt, as a PDF.
   *
   * Streams the file rather than returning JSON, so it is deliberately outside
   * the usual success envelope — the response body is the document. Access is
   * checked inside the service: a parent gets only their own child's.
   */
  @Get('invoices/:id/receipt.pdf')
  async invoiceReceipt(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const { pdf, fileName } = await this.feeDocuments.renderInvoice(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.length),
      'Content-Disposition': `attachment; filename="${fileName}"`,
      // A receipt names a child and their fees — never let a proxy cache it.
      'Cache-Control': 'private, no-store',
    });
    res.end(pdf);
  }

  @Get('students/:studentId/invoices')
  studentInvoices(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    // The school side sees the rest of the session laid out; a parent sees
    // only what has actually been billed to them.
    const isSchoolSide = user.role !== UserRole.PARENT;
    return this.feesService.studentInvoices(
      studentId,
      user.schoolId,
      isSchoolSide,
    );
  }

  @Get('dues')
  dues(
    @Query('studentId') studentId: string | undefined,
    @Query('classId') classId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.pendingDues(studentId, classId, user.schoolId);
  }

  // ── Payments & receipts ─────────────────────────────────

  @Post('payments')
  @Roles(...FINANCE_ROLES)
  recordPayment(@Body() dto: RecordPaymentDto, @CurrentUser() user: AuthUser) {
    return this.feesService.recordPayment(dto, user.userId, user.schoolId);
  }

  @Get('receipts/:id')
  getReceipt(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.feesService.getReceipt(id, user.schoolId);
  }

  // ── Online payment (Razorpay) ───────────────────────────
  //
  // Open to any signed-in member of the school: a parent paying their own
  // child's invoice, or the office opening checkout at the counter. The
  // invoice is scoped to the caller's school, so nobody can pay into another.

  /** Starts a payment: returns the order the client hands to Razorpay. */
  @Post('invoices/:id/checkout')
  checkout(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.feesService.createCheckout(id, user.schoolId, user.userId);
  }

  /**
   * The client's success callback. The webhook is authoritative, but this
   * lets the app show a settled invoice straight away instead of waiting for
   * Razorpay to call us — whichever arrives first settles, the other no-ops.
   */
  @Post('payments/verify')
  @HttpCode(HttpStatus.OK)
  verifyPayment(
    @Body() dto: VerifyPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.verifyAndSettle(dto, user.schoolId);
  }

  // ── Reports ─────────────────────────────────────────────

  @Get('reports/collection')
  @Roles(...FINANCE_ROLES, UserRole.PRINCIPAL)
  collectionReport(
    @Query() query: ReportRangeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feesService.collectionSummary(
      query.from,
      query.to,
      user.schoolId,
    );
  }

  @Get('reports/outstanding')
  @Roles(...FINANCE_ROLES, UserRole.PRINCIPAL)
  outstandingReport(@CurrentUser() user: AuthUser) {
    return this.feesService.outstandingSummary(user.schoolId);
  }
}
