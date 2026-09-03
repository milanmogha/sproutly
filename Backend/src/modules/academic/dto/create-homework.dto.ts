import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateHomeworkDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(80)
  subject: string;

  @IsMongoId()
  classId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsDateString()
  assignedDate?: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
