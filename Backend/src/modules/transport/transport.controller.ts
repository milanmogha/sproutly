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
import { TransportService } from './transport.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Controller('transport')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() dto: CreateVehicleDto, @CurrentUser() user: AuthUser) {
    return this.transportService.create(dto, user.schoolId);
  }

  /** The route this user rides — their child's, or the one they staff. */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.transportService.findForUser(user.userId, user.role, user.schoolId);
  }

  @Get()
  findAll(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      user.schoolId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transportService.findOne(id, user.schoolId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: CreateVehicleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportService.update(id, dto, user.schoolId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.transportService.remove(id, user.schoolId);
  }

  @Post(':id/assign-student')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  assignStudent(
    @Param('id') id: string,
    @Body('studentId') studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportService.assignStudent(id, studentId, user.schoolId);
  }

  @Delete(':id/unassign-student/:studentId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  unassignStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportService.unassignStudent(id, studentId, user.schoolId);
  }

  @Post(':id/assign-staff')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  assignStaff(
    @Param('id') id: string,
    @Body('staffId') staffId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportService.assignStaff(id, staffId, user.schoolId);
  }

  @Delete(':id/unassign-staff/:staffId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  unassignStaff(
    @Param('id') id: string,
    @Param('staffId') staffId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.transportService.unassignStaff(id, staffId, user.schoolId);
  }
}
