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
import { LeaveStatus } from '../../common/enums/leave-status.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { LeaveService } from './leave.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';

const REVIEW_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
] as const;

@Controller('leave')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  // Any authenticated user (teacher, parent, staff…) may apply.
  @Post()
  create(@Body() dto: ApplyLeaveDto, @CurrentUser() user: AuthUser) {
    return this.leaveService.create(dto, user.userId, user.role, user.schoolId);
  }

  // Admins see the whole school; everyone else sees only their own requests.
  @Get()
  findAll(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('status') status: LeaveStatus | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const isReviewer = (REVIEW_ROLES as readonly string[]).includes(user.role);
    return this.leaveService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      user.schoolId,
      status,
      isReviewer ? undefined : user.userId,
    );
  }

  // Student leave requests for the classes this teacher is in charge of.
  // Declared before ':id' so "class" isn't captured as an id.
  @Get('class')
  @Roles(UserRole.TEACHER, UserRole.SUPER_ADMIN, UserRole.ADMIN)
  forMyClass(
    @Query('status') status: LeaveStatus | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leaveService.findForClassTeacher(
      user.userId,
      user.schoolId,
      status,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.leaveService.findOne(id, user.schoolId);
  }

  // Class teachers may decide their own students' leaves; scoping is enforced
  // in the service.
  @Patch(':id')
  @Roles(...REVIEW_ROLES, UserRole.TEACHER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.leaveService.updateStatus(
      id,
      dto,
      user.userId,
      user.role,
      user.schoolId,
    );
  }

  // Applicant cancels their own pending request.
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.leaveService.cancelOwn(id, user.userId, user.schoolId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.leaveService.remove(id, user.schoolId);
  }
}
