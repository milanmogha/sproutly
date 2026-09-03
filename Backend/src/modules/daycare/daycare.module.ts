import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsModule } from '../students/students.module';
import { DaycareController } from './daycare.controller';
import { DaycareService } from './daycare.service';
import { MealUpdate, MealUpdateSchema } from './schemas/meal-update.schema';
import { NapUpdate, NapUpdateSchema } from './schemas/nap-update.schema';
import { ActivityLog, ActivityLogSchema } from './schemas/activity-log.schema';
import {
  HealthUpdate,
  HealthUpdateSchema,
} from './schemas/health-update.schema';
import {
  BehavioralObservation,
  BehavioralObservationSchema,
} from './schemas/behavioral-observation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MealUpdate.name, schema: MealUpdateSchema },
      { name: NapUpdate.name, schema: NapUpdateSchema },
      { name: ActivityLog.name, schema: ActivityLogSchema },
      { name: HealthUpdate.name, schema: HealthUpdateSchema },
      { name: BehavioralObservation.name, schema: BehavioralObservationSchema },
    ]),
    // Resolve a student's class when stamping daycare entries.
    StudentsModule,
  ],
  controllers: [DaycareController],
  providers: [DaycareService],
  exports: [DaycareService],
})
export class DaycareModule {}
