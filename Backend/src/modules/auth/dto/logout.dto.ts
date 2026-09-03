import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  /** The device's refresh token. Omitted → every device is signed out. */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
