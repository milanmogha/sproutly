import { IsEmail } from 'class-validator';

// ── Phone/WhatsApp OTP — DISABLED while the WhatsApp provider (BuzzFlow) is down ──
// Restore this (and remove the email version below) once WhatsApp is back.
// import { Matches } from 'class-validator';
// import { INDIAN_PHONE_REGEX } from '../../../common/utils/phone.util';
//
// export class RequestOtpDto {
//   @Matches(INDIAN_PHONE_REGEX, {
//     message: 'phone must be a valid Indian mobile number',
//   })
//   phone: string;
// }

export class RequestOtpDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;
}
