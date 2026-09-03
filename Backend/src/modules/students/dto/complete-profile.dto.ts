import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AddressDto,
  EmergencyContactDto,
  GuardianDto,
  MedicalInfoDto,
} from './create-student.dto';

/**
 * Fields a parent fills when completing their child's profile. Everything the
 * admin already set (name, DOB, gender, class, admission no.) is intentionally
 * absent — parents cannot change it. All sections are optional so a parent can
 * submit what they have.
 */
export class CompleteProfileDto {
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

/** A parent's free-text request for the admin to change a locked profile. */
export class ProfileChangeRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  message: string;
}
