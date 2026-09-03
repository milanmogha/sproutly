import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateSchoolAdminDto } from './create-school-admin.dto';

export class SchoolAddressDto {
  @IsOptional() @IsString() @MaxLength(120) line1?: string;
  @IsOptional() @IsString() @MaxLength(120) line2?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
}

export class CreateSchoolDto {
  @IsString()
  @MaxLength(120)
  name: string;

  /** Optional — auto-generated from the name when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  /**
   * The owner this school is a branch of. Omit for an independent school;
   * branches under different names are grouped by this id, never by name.
   */
  @IsOptional()
  @IsMongoId()
  ownerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolAddressDto)
  address?: SchoolAddressDto;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  // ── Printed-document header (fee receipts) ──────────────

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledModules?: string[];

  /**
   * The school IS its admin account — creating a school normally creates its
   * admin login in the same request. Optional so admins can also be added
   * later via POST /schools/:id/admins.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSchoolAdminDto)
  admin?: CreateSchoolAdminDto;
}
