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
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';

const MANAGE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
] as const;

@Controller('holidays')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  /** Any signed-in user reads their school's holidays (for calendars). */
  @Get()
  findAll(
    @Query('year') year: string | undefined,
    @Query('upcoming') upcoming: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.holidaysService.findAll(user.schoolId, {
      year: year ? parseInt(year, 10) : undefined,
      upcoming: upcoming === 'true',
    });
  }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreateHolidayDto, @CurrentUser() user: AuthUser) {
    return this.holidaysService.create(dto, user.userId, user.schoolId);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.holidaysService.remove(id, user.schoolId);
  }
}
