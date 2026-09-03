import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CommunicationService } from './communication.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateCircularDto } from './dto/create-circular.dto';
import { CreatePtmRequestDto } from './dto/create-ptm-request.dto';
import { CreateClassPtmDto } from './dto/create-class-ptm.dto';
import { RespondPtmDto } from './dto/respond-ptm.dto';
import { CreateEmergencyAlertDto } from './dto/create-emergency-alert.dto';
import { QueryCircularsDto } from './dto/query-circulars.dto';

const PUBLISH_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.TEACHER,
] as const;

const BROADCAST_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
] as const;

@Controller('communication')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  // ── Messages ────────────────────────────────────────────

  @Post('messages')
  send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthUser) {
    return this.communicationService.sendMessage(dto, user);
  }

  @Get('messages/inbox')
  inbox(@CurrentUser('userId') userId: string, @CurrentUser() user: AuthUser) {
    return this.communicationService.inbox(userId, user.schoolId);
  }

  @Get('messages/sent')
  sent(@CurrentUser('userId') userId: string, @CurrentUser() user: AuthUser) {
    return this.communicationService.sent(userId, user.schoolId);
  }

  @Get('messages/unread-count')
  unread(
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communicationService.unreadCount(userId, user.schoolId);
  }

  /** Who I can start a chat with: teachers + parents for the office, the
   *  office for a teacher or parent. */
  @Get('messages/contacts')
  contacts(@CurrentUser() user: AuthUser) {
    return this.communicationService.chatContacts(user);
  }

  /** My conversations (sent + received), collapsed one row per other party. */
  @Get('messages/threads')
  threads(
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communicationService.threads(userId, user.schoolId);
  }

  @Get('messages/conversation/:userId')
  conversation(
    @Param('userId') otherId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communicationService.conversation(
      userId,
      otherId,
      user.schoolId,
    );
  }

  @Patch('messages/:id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communicationService.markRead(id, userId, user.schoolId);
  }

  // ── Circulars ───────────────────────────────────────────

  @Post('circulars')
  @Roles(...PUBLISH_ROLES)
  createCircular(
    @Body() dto: CreateCircularDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communicationService.createCircular(
      dto,
      userId,
      user.schoolId,
    );
  }

  @Get('circulars')
  circulars(
    @Query() query: QueryCircularsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communicationService.listCirculars(query, user.schoolId);
  }

  @Get('circulars/:id')
  circular(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.communicationService.getCircular(id, user.schoolId);
  }

  @Delete('circulars/:id')
  @Roles(...PUBLISH_ROLES)
  removeCircular(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.communicationService.removeCircular(id, user.schoolId);
  }

  // ── PTM requests (school-initiated) ─────────────────────
  //
  // The school calls parent-teacher meetings; parents don't request them. A
  // parent is notified of a meeting and accepts or declines it (see
  // `ptm/:id/respond`), but may not create one — hence PUBLISH_ROLES here,
  // which excludes PARENT.

  @Post('ptm')
  @Roles(...PUBLISH_ROLES)
  createPtm(@Body() dto: CreatePtmRequestDto, @CurrentUser() user: AuthUser) {
    return this.communicationService.createPtm(dto, user);
  }

  /**
   * A PTM for whole classes at once ("PTM for 1A and 2A"). One meeting per
   * student. The admin's is created already scheduled; a teacher's is a
   * request for their own classes, which the admin then decides on. Parents
   * are excluded, as everywhere else in PTM.
   */
  @Post('ptm/classes')
  @Roles(...PUBLISH_ROLES)
  createClassPtm(
    @Body() dto: CreateClassPtmDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communicationService.createPtmForClasses(dto, user);
  }

  /** Requests I created OR (for parents) requests addressed to me. */
  @Get('ptm/mine')
  myPtm(@CurrentUser('userId') userId: string, @CurrentUser() user: AuthUser) {
    return this.communicationService.ptmRequestedBy(userId, user.schoolId);
  }

  @Get('ptm/assigned')
  assignedPtm(
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communicationService.ptmForTeacher(userId, user.schoolId);
  }

  @Get('ptm')
  @Roles(...BROADCAST_ROLES)
  allPtm(@CurrentUser() user: AuthUser) {
    return this.communicationService.ptmAll(user.schoolId);
  }

  /**
   * The school decides: an admin (or the teacher who owns the meeting)
   * schedules or declines it. Parents are excluded — they are notified of the
   * outcome, they don't accept it.
   */
  @Patch('ptm/:id/respond')
  @Roles(...PUBLISH_ROLES)
  respondPtm(
    @Param('id') id: string,
    @Body() dto: RespondPtmDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communicationService.respondPtm(id, dto, user);
  }

  // ── Emergency alerts ────────────────────────────────────

  @Post('alerts')
  @Roles(...BROADCAST_ROLES)
  createAlert(
    @Body() dto: CreateEmergencyAlertDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.communicationService.createAlert(dto, userId, user.schoolId);
  }

  @Get('alerts')
  alerts(@CurrentUser() user: AuthUser) {
    return this.communicationService.listAlerts(user.schoolId);
  }
}
