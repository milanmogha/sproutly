import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type RouteDocument = HydratedDocument<Route>;

@Schema({ timestamps: true })
export class Route {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ type: String, default: null })
  title?: string;

  @Prop({ type: String, default: null })
  notes?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, unknown>;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const RouteSchema = SchemaFactory.createForClass(Route);
