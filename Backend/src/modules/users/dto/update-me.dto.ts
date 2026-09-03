import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { INDIAN_PHONE_REGEX } from '../../../common/utils/phone.util';

/**
 * The only fields a user may change on their own account.
 *
 * This MUST stay a decorated class. `PATCH /users/me` previously took an
 * inline `{ name?, phone? }` type, and an inline type is erased at runtime —
 * ValidationPipe skips validation when the metatype is a plain Object, so
 * `whitelist` stripped nothing and the whole body reached the update. That let
 * any signed-in user set their own `role`, `schoolId` or `password`.
 *
 * Role, school, password and account status are deliberately absent: those are
 * changed through their own guarded routes, never by the account holder.
 */
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(INDIAN_PHONE_REGEX, {
    message: 'phone must be a valid Indian mobile number',
  })
  phone?: string;
}
