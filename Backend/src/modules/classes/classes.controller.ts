import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AllocateStudentDto } from './dto/allocate-student.dto';

const MANAGE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
] as const;

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreateClassDto, @CurrentUser() user: AuthUser) {
    return this.classesService.create(dto, user.schoolId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.classesService.findAll(user.schoolId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.classesService.findOne(id, user.schoolId);
  }

  @Get(':id/students')
  listStudents(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.classesService.listStudents(id, user.schoolId);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.classesService.update(id, dto, user.schoolId);
  }

  @Post(':id/allocate')
  @Roles(...MANAGE_ROLES)
  allocate(
    @Param('id') id: string,
    @Body() dto: AllocateStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.classesService.allocateStudent(
      id,
      dto.studentId,
      user.schoolId,
    );
  }

  @Delete(':id/students/:studentId')
  @Roles(...MANAGE_ROLES)
  deallocate(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.classesService.deallocateStudent(
      id,
      studentId,
      user.schoolId,
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.classesService.remove(id, user.schoolId);
  }
}
