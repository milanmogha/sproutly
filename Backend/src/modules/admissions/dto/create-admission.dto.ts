import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Gender } from '../../../common/enums/gender.enum';
import { INDIAN_PHONE_REGEX } from '../../../common/utils/phone.util';

export class CreateAdmissionDto {
  @IsString()
  @MaxLength(80)
  firstName: string;

  @IsString()
  @MaxLength(80)
  lastName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  @MaxLength(120)
  parentName: string;

  @Matches(INDIAN_PHONE_REGEX, {
    message: 'parentPhone must be a valid Indian mobile number',
  })
  parentPhone: string;

  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @IsOptional()
  @IsMongoId()
  classApplyingFor?: string;

  @Matches(/^\d{4}-\d{4}$/, {
    message: 'academicYear must look like "2026-2027"',
  })
  academicYear: string;

  /** Optional source inquiry this application was converted from. */
  @IsOptional()
  @IsMongoId()
  inquiry?: string;
}
