import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';

export class CreateUserDto {
  @IsString()
  name: string;

  /** Required for staff roles; parents onboard by phone and have no email. */
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * Optional. When omitted, the account is created inactive and an invite
   * (set-password link) is issued — the user activates it themselves.
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsEnum(UserRole)
  role: UserRole;

  /** Required for every role except SUPER_ADMIN. */
  @IsOptional()
  @IsMongoId()
  schoolId?: string;
}
