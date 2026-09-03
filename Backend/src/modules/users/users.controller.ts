import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import {
  type AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import {
  RegisterDeviceTokenDto,
  RemoveDeviceTokenDto,
} from './dto/device-token.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    if (user.role !== UserRole.SUPER_ADMIN) {
      // A school admin can only create accounts inside their own school,
      // and never another super admin.
      if (dto.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Only a super admin can create super admin accounts',
        );
      }
      dto.schoolId = user.schoolId ?? undefined;
    } else if (dto.role === UserRole.TEACHER || dto.role === UserRole.PARENT) {
      // Teachers and parents are onboarded by their own school in the app
      // (parents are auto-created when a student is enrolled) — the super
      // admin only creates school admin accounts.
      throw new ForbiddenException(
        'Super admins cannot create teacher or parent accounts — the school does that',
      );
    }
    return this.usersService.create(dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('schoolId') schoolId?: string,
    @Query('excludeRole') excludeRole?: string,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    // Non-super-admins are always locked to their own school; the super
    // admin may optionally narrow the platform-wide list to one school.
    const effectiveSchoolId = user.schoolId ?? schoolId ?? null;
    // `excludeRole=parent` (comma-separated for several) keeps the staff
    // directory to staff. Filtering here rather than in the client keeps the
    // page counts and pagination honest; unknown role names are ignored.
    const roleValues = Object.values(UserRole) as string[];
    const parseRoles = (value: string | undefined): UserRole[] =>
      (value ?? '')
        .split(',')
        .map((r) => r.trim())
        .filter((r) => roleValues.includes(r)) as UserRole[];
    const excludeRoles = parseRoles(excludeRole);
    // `role=teacher` (comma-separated for several) is what the teacher
    // pickers ask for. Without it every such dropdown listed the whole school
    // — parents and admins included — because an unknown query param is
    // simply ignored rather than refused.
    const roles = parseRoles(role);
    return this.usersService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      effectiveSchoolId,
      excludeRoles,
      roles,
      search?.trim() || undefined,
    );
  }

  /**
   * Any authenticated user can update their own name / phone — and nothing
   * else. {@link UpdateMeDto} is what confines it: an inline body type would
   * be erased at runtime and let the whole payload through to the update.
   */
  @Patch('me')
  updateMe(@Body() dto: UpdateMeDto, @CurrentUser() user: AuthUser) {
    return this.usersService.updateOwnProfile(user.userId, dto);
  }

  // ── Notification preferences (P7) — the caller's reminder opt-ins ──

  @Get('me/notification-prefs')
  myNotificationPrefs(@CurrentUser() user: AuthUser) {
    return this.usersService.getNotificationPrefs(user.userId);
  }

  @Patch('me/notification-prefs')
  updateMyNotificationPrefs(
    @Body() dto: UpdateNotificationPrefsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.updateNotificationPrefs(user.userId, dto);
  }

  // ── Push device tokens — where to deliver this user's notifications ──

  /** Called by the app after every login, and whenever FCM rotates the token. */
  @Post('me/device-token')
  async registerDeviceToken(
    @Body() dto: RegisterDeviceTokenDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.usersService.addDeviceToken(
      user.userId,
      dto.token,
      dto.platform,
    );
    return { registered: true };
  }

  /** Called on logout, so this device stops receiving the user's alerts. */
  @Delete('me/device-token')
  async removeDeviceToken(
    @Body() dto: RemoveDeviceTokenDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.usersService.removeDeviceToken(user.userId, dto.token);
    return { removed: true };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.findOne(id, user.schoolId);
  }

  /**
   * Edits another account's profile.
   *
   * `role` and `schoolId` are no longer part of {@link UpdateUserDto}, so this
   * route cannot grant privileges or move an account between schools — an
   * admin's own `schoolId` still scopes which accounts they can reach at all.
   */
  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.update(id, dto, user.schoolId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.remove(id, user.schoolId);
  }
}
