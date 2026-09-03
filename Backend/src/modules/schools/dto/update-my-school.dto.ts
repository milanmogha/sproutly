import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SchoolAddressDto } from './create-school.dto';

/**
 * Fields an admin may edit on their OWN school (PATCH /schools/mine).
 * Deliberately excludes code / status / enabledModules / isActive — those stay
 * super-admin-only.
 */
export class UpdateMySchoolDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolAddressDto)
  address?: SchoolAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  currentAcademicYear?: string;

  // The school's own letterhead, printed on its fee receipts. Editable here
  // because it describes the school itself, not its standing on the platform.

  @IsOptional()
  @IsString()
  @MaxLength(160)
  trustName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  affiliationNumber?: string;
}
