import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateClassDto {
  @IsString()
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  section?: string;

  @Matches(/^\d{4}-\d{4}$/, {
    message: 'academicYear must look like "2025-2026"',
  })
  academicYear: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  capacity?: number;

  @IsOptional()
  @IsMongoId()
  classTeacher?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  room?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
