import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { INDIAN_PHONE_REGEX } from '../../../common/utils/phone.util';

/**
 * What an admin (or super admin) may change on someone else's account.
 *
 * Deliberately NOT `PartialType(CreateUserDto)`. That inherited `role` and
 * `schoolId`, which turned a routine profile edit into a way to move an
 * account between tenants or hand out privileges. Both are now fixed at
 * creation; changing them means deleting and re-inviting the account.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(INDIAN_PHONE_REGEX, {
    message: 'phone must be a valid Indian mobile number',
  })
  phone?: string;

  /** Deactivating an account revokes its access at the next token refresh. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** An admin resetting a password for someone who cannot use the email flow. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}
