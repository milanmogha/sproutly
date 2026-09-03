import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BloodGroup } from '../../../common/enums/blood-group.enum';
import { Vaccination, VaccinationSchema } from './vaccination.schema';

/**
 * Health information for a student. Embedded inside {@link Student}.
 */
@Schema({ _id: false })
export class MedicalInfo {
  @Prop({ type: String, enum: BloodGroup, default: null })
  bloodGroup?: BloodGroup | null;

  @Prop({ type: [String], default: [] })
  allergies: string[];

  @Prop({ type: [String], default: [] })
  conditions: string[];

  @Prop({ type: [String], default: [] })
  medications: string[];

  @Prop({ type: String, default: null })
  physicianName?: string;

  @Prop({ type: String, default: null })
  physicianPhone?: string;

  @Prop({ type: [VaccinationSchema], default: [] })
  vaccinations: Vaccination[];
}

export const MedicalInfoSchema = SchemaFactory.createForClass(MedicalInfo);
