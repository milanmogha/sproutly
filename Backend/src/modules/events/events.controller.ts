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
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { RegisterEventDto } from './dto/register-event.dto';

const MANAGE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
] as const;

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthUser) {
    return this.eventsService.create(dto, user.userId, user.schoolId);
  }

  @Get()
  findAll(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('upcoming') upcoming: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.eventsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      user.schoolId,
      upcoming === 'true',
    );
  }

  @Get('registrations/mine')
  myRegistrations(@CurrentUser() user: AuthUser) {
    return this.eventsService.myRegistrations(user.userId, user.schoolId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.findOne(id, user.schoolId);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateEventDto>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.eventsService.update(id, dto, user.schoolId);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.remove(id, user.schoolId);
  }

  // Any authenticated user may register (parents register a child).
  @Post(':id/register')
  register(
    @Param('id') id: string,
    @Body() dto: RegisterEventDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.eventsService.register(id, dto, user.userId, user.schoolId);
  }

  @Get(':id/registrations')
  @Roles(...MANAGE_ROLES, UserRole.TEACHER)
  registrations(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.registrations(id, user.schoolId);
  }
}
