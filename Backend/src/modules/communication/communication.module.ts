import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { StudentsModule } from '../students/students.module';
import { ClassesModule } from '../classes/classes.module';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { ChatGateway } from './chat.gateway';
import { Message, MessageSchema } from './schemas/message.schema';
import { Circular, CircularSchema } from './schemas/circular.schema';
import { PtmRequest, PtmRequestSchema } from './schemas/ptm-request.schema';
import {
  EmergencyAlert,
  EmergencyAlertSchema,
} from './schemas/emergency-alert.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Circular.name, schema: CircularSchema },
      { name: PtmRequest.name, schema: PtmRequestSchema },
      { name: EmergencyAlert.name, schema: EmergencyAlertSchema },
    ]),
    // JWT module for WebSocket gateways — reuses the same secret as HTTP auth.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>(
            'jwt.accessExpiresIn',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    NotificationsModule,
    // Circular recipients: by role, or a class's parents via its roster.
    UsersModule,
    StudentsModule,
    // Class-wide PTMs: roster + class teacher per class.
    ClassesModule,
  ],
  controllers: [CommunicationController],
  providers: [CommunicationService, ChatGateway],
  exports: [CommunicationService, ChatGateway],
})
export class CommunicationModule implements OnModuleInit {
  constructor(
    private readonly service: CommunicationService,
    private readonly gateway: ChatGateway,
  ) {}

  onModuleInit(): void {
    // Wire gateway ↔ service so REST-sent messages can also push via
    // Socket.IO, and the service can answer presence queries.
    this.service.setGateway(this.gateway);
  }
}
