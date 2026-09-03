import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AssessmentType } from '../schemas/assessment.schema';

export class CreateAssessmentDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(80)
  subject: string;

  @IsMongoId()
  classId: string;

  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore?: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
