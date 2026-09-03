import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * A non-guardian contact reachable in an emergency.
 * Embedded inside {@link Student}.
 */
@Schema({ _id: false })
export class EmergencyContact {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  relationship: string;

  @Prop({ required: true, trim: true })
  phone: string;
}

export const EmergencyContactSchema =
  SchemaFactory.createForClass(EmergencyContact);
