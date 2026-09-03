import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { UpdateMySchoolDto } from './dto/update-my-school.dto';
import { QuerySchoolsDto } from './dto/query-schools.dto';
import { CreateSchoolAdminDto } from './dto/create-school-admin.dto';
import { SetPaymentGatewayDto } from './dto/payment-gateway.dto';

// Roles allowed to edit their own school's profile.
const MANAGE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.PRINCIPAL,
] as const;

// Any signed-in user may read their own school's contact card.
const ALL_ROLES = Object.values(UserRole);

// Schools are a super-admin-only concept: unlike students/etc (where GETs
// are open to any authenticated user), every route here is super-admin-only.
@Controller('schools')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QuerySchoolsDto) {
    return this.schoolsService.findAll(query);
  }

  @Get('stats')
  stats() {
    return this.schoolsService.stats();
  }

  /**
   * The caller's own school contact card (name, phone, email, address).
   * Open to every signed-in role — parents/teachers use it for "School contacts".
   * Declared before `:id` so the literal path wins the route match.
   */
  @Get('mine')
  @Roles(...ALL_ROLES)
  mySchool(@CurrentUser() user: AuthUser) {
    return this.schoolsService.contactInfo(user.schoolId);
  }

  /**
   * An admin edits their OWN school's profile (name / contact / address /
   * academic year). Scoped to the caller's token — they can't edit another
   * school. Declared before `:id` so the literal path wins.
   */
  @Patch('mine')
  @Roles(...MANAGE_ROLES)
  updateMine(@Body() dto: UpdateMySchoolDto, @CurrentUser() user: AuthUser) {
    return this.schoolsService.updateMine(user.schoolId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.schoolsService.findOne(id);
  }

  /** School info + headline counts for the detail page. */
  @Get(':id/overview')
  overview(@Param('id') id: string) {
    return this.schoolsService.overview(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.schoolsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schoolsService.remove(id);
  }

  /** Suspends a school — its accounts can no longer sign in until reactivated. */
  @Patch(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.schoolsService.suspend(id);
  }

  /** Lifts a suspension, returning the school to active. */
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.schoolsService.reactivate(id);
  }

  /** Bootstraps the first admin account for a school. */
  @Post(':id/admins')
  createAdmin(@Param('id') id: string, @Body() dto: CreateSchoolAdminDto) {
    return this.schoolsService.createAdmin(id, dto);
  }

  // ── Payment gateway ─────────────────────────────────────
  //
  // Each school pays into its OWN Razorpay account, so the platform never
  // touches the money. The school hands its keys to the super admin, who
  // enters them here — the school's own admin can neither see nor change them.
  // The whole controller is already @Roles(SUPER_ADMIN).

  @Get(':id/payment-gateway')
  paymentGateway(@Param('id') id: string) {
    return this.schoolsService.paymentGatewayStatus(id);
  }

  @Put(':id/payment-gateway')
  setPaymentGateway(
    @Param('id') id: string,
    @Body() dto: SetPaymentGatewayDto,
  ) {
    return this.schoolsService.setPaymentGateway(id, dto);
  }

  @Delete(':id/payment-gateway')
  clearPaymentGateway(@Param('id') id: string) {
    return this.schoolsService.clearPaymentGateway(id);
  }
}
