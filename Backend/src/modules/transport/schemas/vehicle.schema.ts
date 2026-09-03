import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type VehicleDocument = HydratedDocument<Vehicle>;

@Schema({ timestamps: true })
export class Vehicle {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: String, default: null })
  title?: string;

  @Prop({ type: String, default: null })
  notes?: string;

  @Prop({ type: String, default: null })
  vehicleNumber?: string;

  @Prop({ type: String, default: null })
  driverName?: string;

  @Prop({ type: String, default: null })
  driverPhone?: string;

  @Prop({ type: String, default: null })
  routeName?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, unknown>;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'Student' }], default: [] })
  assignedStudents: Types.ObjectId[];

  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'User' }], default: [] })
  assignedStaff: Types.ObjectId[];
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);
