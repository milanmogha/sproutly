import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { CircularAudience } from '../schemas/circular.schema';

export class QueryCircularsDto {
  @IsOptional()
  @IsEnum(CircularAudience)
  audience?: CircularAudience;

  @IsOptional()
  @IsMongoId()
  classId?: string;
}
