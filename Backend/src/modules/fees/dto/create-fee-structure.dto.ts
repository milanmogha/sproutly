import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FeeFrequency } from '../../../common/enums/fee-frequency.enum';

export class FeeComponentDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateFeeStructureDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @Matches(/^\d{4}-\d{4}$/, {
    message: 'academicYear must look like "2026-2027"',
  })
  academicYear: string;

  @IsOptional()
  @IsMongoId()
  classId?: string;

  @IsOptional()
  @IsEnum(FeeFrequency)
  frequency?: FeeFrequency;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeeComponentDto)
  components: FeeComponentDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDayOfMonth?: number;
}
