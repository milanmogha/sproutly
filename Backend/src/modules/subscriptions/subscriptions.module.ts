import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { FeesModule } from '../fees/fees.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { SchoolsModule } from '../schools/schools.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsWebhookController } from './subscriptions-webhook.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionGuard } from './subscription.guard';
import {
  SubscriptionInvoice,
  SubscriptionInvoiceSchema,
} from './schemas/subscription-invoice.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubscriptionInvoice.name, schema: SubscriptionInvoiceSchema },
    ]),
    // Reuses the Razorpay wrapper from fees — same SDK, different account.
    FeesModule,
    // The guard runs globally, ahead of JwtAuthGuard, so it verifies the
    // bearer token itself to know who is asking.
    JwtModule.register({}),
    // Renewal reminders go to the school's admins only.
    NotificationsModule,
    UsersModule,
    // Read-only: the platform overview lists every school, including the ones
    // that have never been billed.
    SchoolsModule,
  ],
  controllers: [SubscriptionsController, SubscriptionsWebhookController],
  providers: [
    SubscriptionsService,
    // Registered here rather than in AppModule so it resolves in this
    // module's injector, where JwtService and the invoice model live.
    { provide: APP_GUARD, useClass: SubscriptionGuard },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
