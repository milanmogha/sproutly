import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Mood } from '../schemas/behavioral-observation.schema';

export class CreateBehavioralObservationDto {
  @IsMongoId()
  studentId: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsEnum(Mood)
  mood: Mood;

  @IsString()
  @MaxLength(500)
  observation: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  context?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
