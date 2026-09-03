import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class ClassQueryDto {
  @IsMongoId()
  classId: string;

  @IsOptional()
  @IsString()
  subject?: string;
}
