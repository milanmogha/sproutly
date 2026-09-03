import { IsDateString, IsEnum, IsMongoId, IsOptional } from 'class-validator';

export enum CheckAction {
  CHECK_IN = 'check_in',
  CHECK_OUT = 'check_out',
}

export class StaffCheckInOutDto {
  @IsMongoId()
  staffId: string;

  @IsEnum(CheckAction)
  action: CheckAction;

  @IsOptional()
  @IsDateString()
  at?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
