import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import { WhatsappProvider } from './providers/whatsapp.provider';
import { MetaWhatsappProvider } from './providers/meta.provider';
import { BuzzflowWhatsappProvider } from './providers/buzzflow.provider';

/**
 * Global so anything that needs to message a parent — auth's login codes
 * today, reminders later — can inject WhatsappService without re-importing.
 *
 * The transport is chosen once, here, from `WHATSAPP_PROVIDER`. Everything
 * downstream depends on the abstract WhatsappProvider and never learns which
 * one it got.
 */
@Global()
@Module({
  providers: [
    WhatsappService,
    MetaWhatsappProvider,
    BuzzflowWhatsappProvider,
    {
      provide: WhatsappProvider,
      inject: [ConfigService, MetaWhatsappProvider, BuzzflowWhatsappProvider],
      useFactory: (
        config: ConfigService,
        meta: MetaWhatsappProvider,
        buzzflow: BuzzflowWhatsappProvider,
      ): WhatsappProvider =>
        config.get<string>('whatsapp.provider') === 'buzzflow' ? buzzflow : meta,
    },
  ],
  exports: [WhatsappService],
})
export class WhatsappModule {}
