import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CircularAudience } from '../schemas/circular.schema';

export class CreateCircularDto {
  @IsString()
  @MaxLength(160)
  title: string;

  @IsString()
  @MaxLength(5000)
  body: string;

  @IsOptional()
  @IsEnum(CircularAudience)
  audience?: CircularAudience;

  @IsOptional()
  @IsMongoId()
  classId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}
