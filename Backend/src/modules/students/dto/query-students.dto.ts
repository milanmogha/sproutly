import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { StudentStatus } from '../../../common/enums/student-status.enum';

export class QueryStudentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsMongoId()
  classId?: string;

  /**
   * Only students who are not in a class yet.
   *
   * A student belongs to one class at a time, so the allocation picker offers
   * exactly these. It is filtered here rather than in the client because the
   * page size is capped — filtering a fetched page would hide everyone past it.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unassigned?: boolean;

  /** Free-text match on first/last name or admission number. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Filter by parent user id — used by the Parent role to list their own children. */
  @IsOptional()
  @IsMongoId()
  parentUserId?: string;
}
