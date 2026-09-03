import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ResultEntryDto {
  @IsMongoId()
  studentId: string;

  @IsNumber()
  @Min(0)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  remarks?: string;
}

/** Enters/updates results for many students against one assessment. */
export class EnterResultDto {
  @IsMongoId()
  assessmentId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ResultEntryDto)
  entries: ResultEntryDto[];
}
