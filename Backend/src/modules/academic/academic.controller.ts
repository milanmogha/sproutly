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
import { AcademicService } from './academic.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { EnterResultDto } from './dto/enter-result.dto';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { CreateSyllabusDto } from './dto/create-syllabus.dto';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import {
  CreateMilestoneDto,
  UpdateMilestoneStatusDto,
} from './dto/create-milestone.dto';
import { CreateTeacherRemarkDto } from './dto/create-teacher-remark.dto';
import { ClassQueryDto } from './dto/query-academic.dto';

const TEACH_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
  UserRole.TEACHER,
] as const;

@Controller('academic')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  // ── Assessments & results ───────────────────────────────

  @Post('assessments')
  @Roles(...TEACH_ROLES)
  createAssessment(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicService.createAssessment(
      dto,
      user.userId,
      user.schoolId,
    );
  }

  @Get('assessments')
  assessments(@Query() q: ClassQueryDto, @CurrentUser() user: AuthUser) {
    return this.academicService.assessmentsByClass(
      q.classId,
      q.subject,
      user.schoolId,
    );
  }

  @Get('assessments/:id')
  assessment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.academicService.getAssessment(id, user.schoolId);
  }

  @Get('assessments/:id/results')
  assessmentResults(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.academicService.resultsByAssessment(id, user.schoolId);
  }

  @Delete('assessments/:id')
  @Roles(...TEACH_ROLES)
  removeAssessment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.academicService.removeAssessment(id, user.schoolId);
  }

  @Post('results')
  @Roles(...TEACH_ROLES)
  enterResults(@Body() dto: EnterResultDto, @CurrentUser() user: AuthUser) {
    return this.academicService.enterResults(
      dto,
      user.userId,
      user.schoolId,
    );
  }

  @Get('students/:studentId/progress')
  studentProgress(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicService.studentProgress(studentId, user.schoolId);
  }

  // ── Homework ────────────────────────────────────────────

  @Post('homework')
  @Roles(...TEACH_ROLES)
  createHomework(
    @Body() dto: CreateHomeworkDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicService.createHomework(
      dto,
      user.userId,
      user.schoolId,
    );
  }

  @Get('homework')
  homework(@Query() q: ClassQueryDto, @CurrentUser() user: AuthUser) {
    return this.academicService.homeworkByClass(q.classId, user.schoolId);
  }

  @Delete('homework/:id')
  @Roles(...TEACH_ROLES)
  removeHomework(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.academicService.removeHomework(id, user.schoolId);
  }

  // ── Syllabus ────────────────────────────────────────────

  @Post('syllabus')
  @Roles(...TEACH_ROLES)
  upsertSyllabus(
    @Body() dto: CreateSyllabusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicService.upsertSyllabus(
      dto,
      user.userId,
      user.schoolId,
    );
  }

  @Get('syllabus')
  syllabus(@Query() q: ClassQueryDto, @CurrentUser() user: AuthUser) {
    return this.academicService.syllabusByClass(q.classId, user.schoolId);
  }

  // ── Lesson plans ────────────────────────────────────────

  @Post('lesson-plans')
  @Roles(...TEACH_ROLES)
  createLessonPlan(
    @Body() dto: CreateLessonPlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicService.createLessonPlan(
      dto,
      user.userId,
      user.schoolId,
    );
  }

  @Get('lesson-plans')
  lessonPlans(@Query() q: ClassQueryDto, @CurrentUser() user: AuthUser) {
    return this.academicService.lessonPlansByClass(q.classId, user.schoolId);
  }

  // ── Milestones ──────────────────────────────────────────

  @Post('milestones')
  @Roles(...TEACH_ROLES)
  createMilestone(
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicService.createMilestone(
      dto,
      user.userId,
      user.schoolId,
    );
  }

  @Get('students/:studentId/milestones')
  milestones(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicService.milestonesByStudent(
      studentId,
      user.schoolId,
    );
  }

  @Patch('milestones/:id')
  @Roles(...TEACH_ROLES)
  updateMilestone(
    @Param('id') id: string,
    @Body() dto: UpdateMilestoneStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicService.updateMilestoneStatus(
      id,
      dto,
      user.schoolId,
    );
  }

  // ── Teacher remarks ─────────────────────────────────────

  @Post('remarks')
  @Roles(...TEACH_ROLES)
  createRemark(
    @Body() dto: CreateTeacherRemarkDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicService.createRemark(
      dto,
      user.userId,
      user.schoolId,
    );
  }

  @Get('students/:studentId/remarks')
  remarks(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.academicService.remarksByStudent(studentId, user.schoolId);
  }
}
