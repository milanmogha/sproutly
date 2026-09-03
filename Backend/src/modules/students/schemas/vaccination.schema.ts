import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * A single vaccination record. Embedded inside {@link MedicalInfo};
 * not a standalone collection.
 */
@Schema({ _id: false })
export class Vaccination {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null })
  doseLabel?: string;

  @Prop({ type: Date, default: null })
  administeredOn?: Date | null;

  @Prop({ type: Date, default: null })
  dueOn?: Date | null;

  @Prop({ type: Boolean, default: false })
  administered: boolean;
}

export const VaccinationSchema = SchemaFactory.createForClass(Vaccination);
