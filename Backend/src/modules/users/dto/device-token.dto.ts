import { IsIn, IsNotEmpty, IsString } from 'class-validator';

/** The device the caller wants to start (or stop) receiving push on. */
export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsIn(['android', 'ios'])
  platform: 'android' | 'ios';
}

export class RemoveDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
