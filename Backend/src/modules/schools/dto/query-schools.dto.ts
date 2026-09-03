import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SchoolStatus } from '../../../common/enums/school-status.enum';

export class QuerySchoolsDto {
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
  @IsEnum(SchoolStatus)
  status?: SchoolStatus;

  /** Free-text match on name or code. */
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Only this owner's branches. `none` narrows to independent schools — the
   * ones not yet grouped under any owner, which is how the super admin finds
   * branches still waiting to be linked.
   */
  @IsOptional()
  @IsString()
  ownerId?: string;
}
