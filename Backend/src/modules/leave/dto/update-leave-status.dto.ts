import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LeaveStatus } from '../../../common/enums/leave-status.enum';

export class UpdateLeaveStatusDto {
  @IsEnum(LeaveStatus)
  status: LeaveStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
