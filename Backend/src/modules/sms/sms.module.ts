import { Global, Module } from '@nestjs/common';
import { SmsService } from './sms.service';

/** Global so any module can inject SmsService without re-importing. */
@Global()
@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
