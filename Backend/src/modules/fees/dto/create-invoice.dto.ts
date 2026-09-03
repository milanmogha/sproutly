import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class InvoiceLineDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;
}

export class CreateInvoiceDto {
  @IsMongoId()
  studentId: string;

  @IsOptional()
  @IsMongoId()
  feeStructureId?: string;

  @IsString()
  @MaxLength(20)
  academicYear: string;

  @IsString()
  @MaxLength(40)
  period: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lineItems: InvoiceLineDto[];

  @IsDateString()
  dueDate: string;
}
