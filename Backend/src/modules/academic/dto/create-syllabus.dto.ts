import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SyllabusUnitDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class CreateSyllabusDto {
  @IsMongoId()
  classId: string;

  @IsString()
  @MaxLength(80)
  subject: string;

  @IsString()
  @MaxLength(20)
  academicYear: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyllabusUnitDto)
  units?: SyllabusUnitDto[];
}
