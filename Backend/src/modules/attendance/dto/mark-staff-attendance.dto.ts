import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';

export class StaffAttendanceEntryDto {
  @IsMongoId()
  staffId: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remarks?: string;
}

/** Marks the whole staff roster's attendance for a single day in one request. */
export class MarkStaffAttendanceDto {
  /** Defaults to today when omitted. */
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StaffAttendanceEntryDto)
  entries: StaffAttendanceEntryDto[];
}
