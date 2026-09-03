import {
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  MilestoneCategory,
  MilestoneStatus,
} from '../schemas/milestone.schema';

export class CreateMilestoneDto {
  @IsMongoId()
  studentId: string;

  @IsString()
  @MaxLength(160)
  title: string;

  @IsOptional()
  @IsEnum(MilestoneCategory)
  category?: MilestoneCategory;

  @IsOptional()
  @IsEnum(MilestoneStatus)
  status?: MilestoneStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class UpdateMilestoneStatusDto {
  @IsEnum(MilestoneStatus)
  status: MilestoneStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
