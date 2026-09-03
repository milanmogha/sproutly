import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class RegisterEventDto {
  @IsOptional()
  @IsMongoId()
  studentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
