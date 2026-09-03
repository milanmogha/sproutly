import { IsMongoId, IsObject, IsOptional, IsString } from 'class-validator';

export class SendNotificationDto {
  @IsMongoId()
  recipient: string;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
