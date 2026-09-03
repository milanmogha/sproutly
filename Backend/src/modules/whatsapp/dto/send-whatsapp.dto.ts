import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

export class SendWhatsappDto {
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'to must be a valid E.164 phone number',
  })
  to: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  params?: string[];
}
