import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateSchoolDto } from './create-school.dto';
import { SchoolStatus } from '../../../common/enums/school-status.enum';

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {
  @IsOptional()
  @IsEnum(SchoolStatus)
  status?: SchoolStatus;
}
