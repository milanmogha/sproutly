import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransportController } from './transport.controller';
import { TransportService } from './transport.service';
import { Vehicle, VehicleSchema } from './schemas/vehicle.schema';
import { Route, RouteSchema } from './schemas/route.schema';
import { Driver, DriverSchema } from './schemas/driver.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Route.name, schema: RouteSchema },
      { name: Driver.name, schema: DriverSchema },
      // Read-only, to resolve a parent's children for `GET /transport/mine`.
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [TransportController],
  providers: [TransportService],
  exports: [TransportService],
})
export class TransportModule {}
