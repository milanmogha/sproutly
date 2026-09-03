import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @MaxLength(120)
  title: string;

  /** ISO date (YYYY-MM-DD). */
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}
