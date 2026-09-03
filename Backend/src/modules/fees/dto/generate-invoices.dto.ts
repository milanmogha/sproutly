import { IsMongoId, IsOptional, Matches } from 'class-validator';

/**
 * Generates a whole session's invoices for every student in a class, driven by
 * the fee structure's frequency (monthly → 12, quarterly → 4, term → 2,
 * annual → 1). Periods and due dates are computed on the server, so the client
 * only picks the structure and the class.
 */
export class GenerateInvoicesDto {
  @IsMongoId()
  feeStructureId: string;

  @IsMongoId()
  classId: string;

  /** Override the structure's academic year, e.g. "2026-2027". */
  @IsOptional()
  @Matches(/^\d{4}-\d{4}$/, {
    message: 'academicYear must look like "2026-2027"',
  })
  academicYear?: string;
}
