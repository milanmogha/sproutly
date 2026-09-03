import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RemarkCategory } from '../schemas/teacher-remark.schema';

export class CreateTeacherRemarkDto {
  @IsMongoId()
  studentId: string;

  @IsString()
  @MaxLength(1000)
  remark: string;

  @IsOptional()
  @IsEnum(RemarkCategory)
  category?: RemarkCategory;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  term?: string;
}
