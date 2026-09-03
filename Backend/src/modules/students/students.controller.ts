import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { StudentsService } from './students.service';
import { CreateStudentDto, GuardianDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import {
  CompleteProfileDto,
  ProfileChangeRequestDto,
} from './dto/complete-profile.dto';
import { QueryStudentsDto } from './dto/query-students.dto';

// Roles allowed to mutate student records.
const MANAGE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
] as const;

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  /** Students are enrolled by their own school (admin/principal) — never by
   *  the super admin, who has no school of their own. */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.PRINCIPAL)
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: AuthUser) {
    return this.studentsService.create(dto, user.schoolId);
  }

  // Any authenticated user may read the roster (scoped to their own school).
  @Get()
  findAll(@Query() query: QueryStudentsDto, @CurrentUser() user: AuthUser) {
    return this.studentsService.findAll(query, user.schoolId);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.studentsService.stats(user.schoolId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.studentsService.findOne(id, user.schoolId);
  }

  // ── Parent self-service (scoped to the parent's own child) ──

  /** A parent completes their child's profile (once — then it locks). */
  @Patch(':id/profile')
  @Roles(UserRole.PARENT)
  completeProfile(
    @Param('id') id: string,
    @Body() dto: CompleteProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentsService.completeProfile(id, user.userId, dto);
  }

  /** A parent asks the admin to change an already-completed (locked) profile. */
  @Post(':id/change-request')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.PARENT)
  requestProfileChange(
    @Param('id') id: string,
    @Body() dto: ProfileChangeRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentsService.requestProfileChange(
      id,
      user.userId,
      dto.message,
    );
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentsService.update(id, dto, user.schoolId);
  }

  @Post(':id/guardians')
  @Roles(...MANAGE_ROLES)
  addGuardian(
    @Param('id') id: string,
    @Body() dto: GuardianDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentsService.addGuardian(id, dto, user.schoolId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.studentsService.remove(id, user.schoolId);
  }
}
