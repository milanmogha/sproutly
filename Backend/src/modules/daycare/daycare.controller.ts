import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { DaycareService } from './daycare.service';
import type { DaycareEntryType } from './daycare.service';
import { CreateMealUpdateDto } from './dto/create-meal-update.dto';
import { CreateNapUpdateDto } from './dto/create-nap-update.dto';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { CreateHealthUpdateDto } from './dto/create-health-update.dto';
import { CreateBehavioralObservationDto } from './dto/create-behavioral-observation.dto';
import { DiaryQueryDto, ListDaycareDto } from './dto/query-daycare.dto';

// Staff who log daycare updates.
const STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.TEACHER,
] as const;

@Controller('daycare')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DaycareController {
  constructor(private readonly daycareService: DaycareService) {}

  // ── Meals ───────────────────────────────────────────────

  @Post('meals')
  @Roles(...STAFF_ROLES)
  createMeal(
    @Body() dto: CreateMealUpdateDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.daycareService.createMeal(dto, userId, user.schoolId);
  }

  @Get('meals')
  meals(@Query() q: ListDaycareDto, @CurrentUser() user: AuthUser) {
    return this.daycareService.meals(q.studentId, q.date, user.schoolId);
  }

  // ── Naps ────────────────────────────────────────────────

  @Post('naps')
  @Roles(...STAFF_ROLES)
  createNap(
    @Body() dto: CreateNapUpdateDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.daycareService.createNap(dto, userId, user.schoolId);
  }

  @Get('naps')
  naps(@Query() q: ListDaycareDto, @CurrentUser() user: AuthUser) {
    return this.daycareService.naps(q.studentId, q.date, user.schoolId);
  }

  // ── Activities ──────────────────────────────────────────

  @Post('activities')
  @Roles(...STAFF_ROLES)
  createActivity(
    @Body() dto: CreateActivityLogDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.daycareService.createActivity(dto, userId, user.schoolId);
  }

  @Get('activities')
  activities(@Query() q: ListDaycareDto, @CurrentUser() user: AuthUser) {
    return this.daycareService.activities(q.studentId, q.date, user.schoolId);
  }

  // ── Health ──────────────────────────────────────────────

  @Post('health')
  @Roles(...STAFF_ROLES)
  createHealth(
    @Body() dto: CreateHealthUpdateDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.daycareService.createHealth(dto, userId, user.schoolId);
  }

  @Get('health')
  health(@Query() q: ListDaycareDto, @CurrentUser() user: AuthUser) {
    return this.daycareService.health(q.studentId, q.date, user.schoolId);
  }

  // ── Behavioral observations ─────────────────────────────

  @Post('observations')
  @Roles(...STAFF_ROLES)
  createObservation(
    @Body() dto: CreateBehavioralObservationDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.daycareService.createObservation(dto, userId, user.schoolId);
  }

  @Get('observations')
  observations(@Query() q: ListDaycareDto, @CurrentUser() user: AuthUser) {
    return this.daycareService.observations(
      q.studentId,
      q.date,
      user.schoolId,
    );
  }

  // ── Digital diary ───────────────────────────────────────

  @Get('diary/:studentId')
  diary(
    @Param('studentId') studentId: string,
    @Query() q: DiaryQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.daycareService.diary(studentId, q.date, user.schoolId);
  }

  @Delete(':type/:id')
  @Roles(...STAFF_ROLES)
  remove(
    @Param('type') type: DaycareEntryType,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.daycareService.remove(type, id, user.schoolId);
  }
}
