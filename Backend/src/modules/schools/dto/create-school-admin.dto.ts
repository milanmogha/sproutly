import { OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from '../../users/dto/create-user.dto';

/** role and schoolId are set by SchoolsService.createAdmin(), not the caller. */
export class CreateSchoolAdminDto extends OmitType(CreateUserDto, [
  'role',
  'schoolId',
] as const) {}
