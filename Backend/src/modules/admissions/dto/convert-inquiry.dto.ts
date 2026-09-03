import { IsMongoId, IsOptional, Matches } from 'class-validator';

/** Promotes an inquiry to a formal admission application. */
export class ConvertInquiryDto {
  @Matches(/^\d{4}-\d{4}$/, {
    message: 'academicYear must look like "2026-2027"',
  })
  academicYear: string;

  @IsOptional()
  @IsMongoId()
  classApplyingFor?: string;
}
