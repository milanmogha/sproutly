import { IsBoolean, IsOptional } from 'class-validator';

/** Partial update of the caller's reminder opt-ins (P7). */
export class UpdateNotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  feeReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  attendanceAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  homeworkNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  eventReminders?: boolean;

  /** Direct-message alerts (parent <-> teacher chat). Shared across roles. */
  @IsOptional()
  @IsBoolean()
  messageNotifications?: boolean;
}
