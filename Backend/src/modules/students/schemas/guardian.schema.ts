import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { GuardianRelationship } from '../../../common/enums/guardian-relationship.enum';

/**
 * A parent/guardian associated with a student.
 * Embedded inside {@link Student}.
 */
@Schema({ _id: false })
export class Guardian {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: GuardianRelationship, required: true })
  relationship: GuardianRelationship;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ type: String, default: null })
  email?: string;

  @Prop({ type: String, default: null })
  occupation?: string;

  @Prop({ type: Boolean, default: false })
  isPrimary: boolean;
}

export const GuardianSchema = SchemaFactory.createForClass(Guardian);
