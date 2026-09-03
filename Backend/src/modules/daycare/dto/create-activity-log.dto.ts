import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ActivityCategory } from '../schemas/activity-log.schema';

export class CreateActivityLogDto {
  @IsMongoId()
  studentId: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsEnum(ActivityCategory)
  category?: ActivityCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
