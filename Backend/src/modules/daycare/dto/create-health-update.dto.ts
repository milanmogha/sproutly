import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  HealthSeverity,
  HealthUpdateType,
} from '../schemas/health-update.schema';

export class CreateHealthUpdateDto {
  @IsMongoId()
  studentId: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsEnum(HealthUpdateType)
  type: HealthUpdateType;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(45)
  temperature?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  medication?: string;

  @IsOptional()
  @IsEnum(HealthSeverity)
  severity?: HealthSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
