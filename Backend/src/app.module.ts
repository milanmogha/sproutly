import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import firebaseConfig from './config/firebase.config';
import jwtConfig from './config/jwt.config';
import mailConfig from './config/mail.config';
import storageConfig from './config/storage.config';
import whatsappConfig from './config/whatsapp.config';
import billingConfig from './config/billing.config';

import { DatabaseModule } from './database/database.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

import { MailModule } from './modules/mail/mail.module';
import { SmsModule } from './modules/sms/sms.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { OwnersModule } from './modules/owners/owners.module';
import { StudentsModule } from './modules/students/students.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { FeesModule } from './modules/fees/fees.module';
import { AcademicModule } from './modules/academic/academic.module';
import { DaycareModule } from './modules/daycare/daycare.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { EventsModule } from './modules/events/events.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { LeaveModule } from './modules/leave/leave.module';
import { TransportModule } from './modules/transport/transport.module';
import { StaffModule } from './modules/staff/staff.module';
import { ClassesModule } from './modules/classes/classes.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        databaseConfig,
        firebaseConfig,
        jwtConfig,
        mailConfig,
        storageConfig,
        whatsappConfig,
        billingConfig,
      ],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    // Drives the daily fee-reminder cron (FeesService.sendDueReminders).
    ScheduleModule.forRoot(),
    DatabaseModule,

    MailModule,
    SmsModule,
    AuthModule,
    UsersModule,
    SchoolsModule,
    OwnersModule,
    StudentsModule,
    AdmissionsModule,
    AttendanceModule,
    FeesModule,
    AcademicModule,
    DaycareModule,
    CommunicationModule,
    NotificationsModule,
    WhatsappModule,
    EventsModule,
    HolidaysModule,
    GalleryModule,
    LeaveModule,
    TransportModule,
    StaffModule,
    ClassesModule,
    DashboardModule,
    SubscriptionsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
