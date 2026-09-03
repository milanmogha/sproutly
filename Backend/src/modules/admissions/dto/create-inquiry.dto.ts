import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Gender } from '../../../common/enums/gender.enum';
import { INDIAN_PHONE_REGEX } from '../../../common/utils/phone.util';
import { InquirySource } from '../schemas/inquiry.schema';

export class CreateInquiryDto {
  @IsString()
  @MaxLength(120)
  childName: string;

  @IsOptional()
  @IsDateString()
  childDateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

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
  @IsString()
  @MaxLength(60)
  gradeInterested?: string;

  @IsOptional()
  @IsEnum(InquirySource)
  source?: InquirySource;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
