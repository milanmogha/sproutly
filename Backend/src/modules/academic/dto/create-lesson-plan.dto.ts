import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateLessonPlanDto {
  @IsMongoId()
  classId: string;

  @IsString()
  @MaxLength(80)
  subject: string;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activities?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resources?: string;
}
