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
import {
  type AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { AdmissionsService } from './admissions.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { ConvertInquiryDto } from './dto/convert-inquiry.dto';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { UpdateAdmissionDto } from './dto/update-admission.dto';
import {
  QueryAdmissionsDto,
  QueryInquiriesDto,
} from './dto/query-admissions.dto';

const ADMISSION_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
] as const;

@Controller('admissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMISSION_ROLES)
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  // ── Inquiries ───────────────────────────────────────────

  @Post('inquiries')
  createInquiry(
    @Body() dto: CreateInquiryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admissionsService.createInquiry(dto, user.schoolId);
  }

  @Get('inquiries')
  findInquiries(
    @Query() query: QueryInquiriesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admissionsService.findInquiries(query, user.schoolId);
  }

  @Get('inquiries/:id')
  getInquiry(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.admissionsService.getInquiry(id, user.schoolId);
  }

  @Patch('inquiries/:id')
  updateInquiry(
    @Param('id') id: string,
    @Body() dto: UpdateInquiryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admissionsService.updateInquiry(id, dto, user.schoolId);
  }

  @Post('inquiries/:id/convert')
  convertInquiry(
    @Param('id') id: string,
    @Body() dto: ConvertInquiryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admissionsService.convertInquiry(id, dto, user.schoolId);
  }

  @Delete('inquiries/:id')
  removeInquiry(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.admissionsService.removeInquiry(id, user.schoolId);
  }

  // ── Applications ────────────────────────────────────────

  @Post('applications')
  createAdmission(
    @Body() dto: CreateAdmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admissionsService.createAdmission(dto, user.schoolId);
  }

  @Get('applications')
  findAdmissions(
    @Query() query: QueryAdmissionsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admissionsService.findAdmissions(query, user.schoolId);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.admissionsService.stats(user.schoolId);
  }

  @Get('waitlist')
  waitlist(@CurrentUser() user: AuthUser) {
    return this.admissionsService.waitlist(user.schoolId);
  }

  @Get('applications/:id')
  getAdmission(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.admissionsService.getAdmission(id, user.schoolId);
  }

  @Patch('applications/:id/decision')
  decide(
    @Param('id') id: string,
    @Body() dto: UpdateAdmissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admissionsService.decide(id, dto, user.schoolId);
  }

  @Post('applications/:id/enroll')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  enroll(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.admissionsService.enroll(id, user.schoolId);
  }
}
