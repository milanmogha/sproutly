import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassesModule } from '../classes/classes.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import {
  LeaveRequest,
  LeaveRequestSchema,
} from './schemas/leave-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LeaveRequest.name, schema: LeaveRequestSchema },
    ]),
    // Class-teacher checks for scoping teacher leave approvals.
    ClassesModule,
  ],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
