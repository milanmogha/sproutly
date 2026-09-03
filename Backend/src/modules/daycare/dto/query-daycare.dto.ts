import { IsDateString, IsMongoId, IsOptional } from 'class-validator';

/** Listing entries for one student, optionally filtered to a day. */
export class ListDaycareDto {
  @IsMongoId()
  studentId: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

/** Diary lookup query (studentId comes from the path). */
export class DiaryQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
