import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsMongoId()
  recipientId: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @IsString()
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsMongoId()
  relatedStudent?: string;
}
