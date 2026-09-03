import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { AdmissionStatus } from '../schemas/admission.schema';

/** Records a decision in the approval workflow (approve/reject/waitlist…). */
export class UpdateAdmissionDto {
  @IsEnum(AdmissionStatus)
  status: AdmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNotes?: string;

  /** Position when the decision is "waitlisted". */
  @IsOptional()
  @IsInt()
  @Min(1)
  waitlistPosition?: number;
}
