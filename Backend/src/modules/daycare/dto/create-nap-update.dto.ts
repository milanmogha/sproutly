import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NapQuality } from '../schemas/nap-update.schema';

export class CreateNapUpdateDto {
  @IsMongoId()
  studentId: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsEnum(NapQuality)
  quality?: NapQuality;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
