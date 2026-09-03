import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export enum CircularAudience {
  ALL = 'all',
  PARENTS = 'parents',
  TEACHERS = 'teachers',
  STAFF = 'staff',
  CLASS = 'class',
}

export type CircularDocument = HydratedDocument<Circular>;

@Schema({ timestamps: true })
export class Circular {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'School', required: true, index: true })
  schoolId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  body: string;

  @Prop({
    type: String,
    enum: CircularAudience,
    default: CircularAudience.ALL,
    index: true,
  })
  audience: CircularAudience;

  /** Target class when audience is "class". */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Class', default: null, index: true })
  classId?: Types.ObjectId | null;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ type: Boolean, default: false })
  pinned: boolean;

  @Prop({ type: Date, default: () => new Date(), index: true })
  publishedAt: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null })
  publishedBy?: Types.ObjectId | null;
}

export const CircularSchema = SchemaFactory.createForClass(Circular);
