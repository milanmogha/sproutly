import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PtmStatus } from '../schemas/ptm-request.schema';

export class RespondPtmDto {
  @IsEnum(PtmStatus)
  status: PtmStatus;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  responseNote?: string;
}
