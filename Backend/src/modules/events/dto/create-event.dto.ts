import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { EventAudience } from '../schemas/event.schema';

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsEnum(EventAudience)
  audience?: EventAudience;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
