import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CircularAudience } from '../schemas/circular.schema';
import { AlertSeverity } from '../schemas/emergency-alert.schema';

export class CreateEmergencyAlertDto {
  @IsString()
  @MaxLength(160)
  title: string;

  @IsString()
  @MaxLength(1000)
  message: string;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @IsOptional()
  @IsEnum(CircularAudience)
  audience?: CircularAudience;

  @IsOptional()
  @IsMongoId()
  classId?: string;
}
