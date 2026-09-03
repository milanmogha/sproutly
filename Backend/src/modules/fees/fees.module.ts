import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsModule } from '../students/students.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchoolsModule } from '../schools/schools.module';
import { FeesController } from './fees.controller';
import { FeesWebhookController } from './fees-webhook.controller';
import { FeesService } from './fees.service';
import { RazorpayService } from './razorpay.service';
import { FeeDocumentService } from './documents/fee-document.service';
import {
  FeeStructure,
  FeeStructureSchema,
} from './schemas/fee-structure.schema';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Receipt, ReceiptSchema } from './schemas/receipt.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FeeStructure.name, schema: FeeStructureSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Receipt.name, schema: ReceiptSchema },
    ]),
    // Roster lookups for bulk invoice generation + student validation.
    StudentsModule,
    // Fee reminders to parents when an invoice is issued.
    NotificationsModule,
    // Each school's own Razorpay credentials live on its School document.
    SchoolsModule,
  ],
  controllers: [FeesController, FeesWebhookController],
  providers: [FeesService, RazorpayService, FeeDocumentService],
  // RazorpayService is shared with subscriptions — same SDK wrapper, but that
  // module talks to the platform's account rather than a school's.
  exports: [FeesService, RazorpayService],
})
export class FeesModule {}
