import { IsMongoId } from 'class-validator';

export class AllocateStudentDto {
  @IsMongoId()
  studentId: string;
}
