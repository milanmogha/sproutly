import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Gender } from '../../../common/enums/gender.enum';
import { StudentStatus } from '../../../common/enums/student-status.enum';
import { BloodGroup } from '../../../common/enums/blood-group.enum';
import { GuardianRelationship } from '../../../common/enums/guardian-relationship.enum';
import { INDIAN_PHONE_REGEX as PHONE_REGEX } from '../../../common/utils/phone.util';

export class AddressDto {
  @IsOptional() @IsString() @MaxLength(120) line1?: string;
  @IsOptional() @IsString() @MaxLength(120) line2?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
}

export class GuardianDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsEnum(GuardianRelationship)
  relationship: GuardianRelationship;

  @Matches(PHONE_REGEX, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class EmergencyContactDto {
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(60) relationship: string;

  @Matches(PHONE_REGEX, { message: 'phone must be a valid phone number' })
  phone: string;
}

export class VaccinationDto {
  @IsString() @MaxLength(120) name: string;

  @IsOptional() @IsString() @MaxLength(60) doseLabel?: string;
  @IsOptional() @IsDateString() administeredOn?: string;
  @IsOptional() @IsDateString() dueOn?: string;
  @IsOptional() @IsBoolean() administered?: boolean;
}

export class MedicalInfoDto {
  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional() @IsArray() @IsString({ each: true }) allergies?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) conditions?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) medications?: string[];

  @IsOptional() @IsString() @MaxLength(120) physicianName?: string;
  @IsOptional() @IsString() physicianPhone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VaccinationDto)
  vaccinations?: VaccinationDto[];
}

export class CreateStudentDto {
  /** Optional — auto-generated (ADM-<year>-<seq>) when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  admissionNumber?: string;

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

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsMongoId()
  classId?: string;

  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;

  /** Parent's phone — provisions/links a phone-OTP parent login for this child. */
  @IsOptional()
  @Matches(PHONE_REGEX, { message: 'parentPhone must be a valid phone number' })
  parentPhone?: string;

  /** Parent's display name (defaults to the primary guardian's name). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  parentName?: string;

  /**
   * Parent's email — their login identity while phone/WhatsApp OTP is disabled.
   * Falls back to the primary guardian's email when omitted.
   */
  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => GuardianDto)
  guardians?: GuardianDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  emergencyContacts?: EmergencyContactDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MedicalInfoDto)
  medicalInfo?: MedicalInfoDto;
}
