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
import { OwnersService } from './owners.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { QueryOwnersDto } from './dto/query-owners.dto';
import { AssignSchoolsDto } from './dto/assign-schools.dto';

/**
 * Owners are a super-admin-only concept, like schools — and more strictly so:
 * every route here reads across school boundaries, which no school-scoped role
 * may ever do. An owner is never an account; branches keep separate admin
 * logins and separate data.
 */
@Controller('owners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post()
  create(@Body() dto: CreateOwnerDto) {
    return this.ownersService.create(dto);
  }

  /** Owners with their branch counts and subscription roll-up. */
  @Get()
  findAll(@Query() query: QueryOwnersDto) {
    return this.ownersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ownersService.findOne(id);
  }

  /** The owner plus every branch and where its subscription stands. */
  @Get(':id/branches')
  branches(@Param('id') id: string) {
    return this.ownersService.detail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOwnerDto) {
    return this.ownersService.update(id, dto);
  }

  /** Detaches every branch; the schools themselves are untouched. */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ownersService.remove(id);
  }

  /** Retrofit path: link schools that already exist to this owner. */
  @Post(':id/schools')
  assignSchools(@Param('id') id: string, @Body() dto: AssignSchoolsDto) {
    return this.ownersService.assignSchools(id, dto.schoolIds);
  }

  @Delete(':id/schools/:schoolId')
  detachSchool(@Param('id') id: string, @Param('schoolId') schoolId: string) {
    return this.ownersService.detachSchool(id, schoolId);
  }
}
