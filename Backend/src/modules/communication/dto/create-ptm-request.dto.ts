import {
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePtmRequestDto {
  @IsMongoId()
  studentId: string;

  /** Parent-initiated: optionally target a specific teacher. */
  @IsOptional()
  @IsMongoId()
  teacherId?: string;

  /** Teacher-initiated: the student's linked parent account, so the request
   *  appears in that parent's list. Ignored when a parent is the requester. */
  @IsOptional()
  @IsMongoId()
  parentId?: string;

  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSlots?: string[];
}
