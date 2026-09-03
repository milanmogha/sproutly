import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import {
  SubscriptionInvoice,
  SubscriptionInvoiceSchema,
} from '../subscriptions/schemas/subscription-invoice.schema';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';
import { Owner, OwnerSchema } from './schemas/owner.schema';

/**
 * Registers the School and SubscriptionInvoice models directly rather than
 * importing SchoolsModule or SubscriptionsModule: SubscriptionsModule already
 * depends on SchoolsModule, and pulling either in here would start a
 * dependency knot for what is only a read across two collections.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Owner.name, schema: OwnerSchema },
      { name: School.name, schema: SchoolSchema },
      { name: SubscriptionInvoice.name, schema: SubscriptionInvoiceSchema },
    ]),
  ],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService],
})
export class OwnersModule {}
