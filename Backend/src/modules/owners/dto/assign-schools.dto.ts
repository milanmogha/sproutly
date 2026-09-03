import { ArrayMinSize, IsArray, IsMongoId } from 'class-validator';

/**
 * Attaches existing schools to an owner. Branches are almost always created
 * before anyone realises they share an owner, so this is the retrofit path —
 * the super admin is the only one who can know the link, since each branch
 * logs in separately and nothing in the data reveals it.
 */
export class AssignSchoolsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  schoolIds: string[];
}
