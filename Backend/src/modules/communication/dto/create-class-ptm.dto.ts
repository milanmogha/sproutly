import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * A PTM called for one or more whole classes — "PTM for 1A and 2A". One
 * meeting is created per student in those classes, so each parent gets their
 * own child's meeting rather than a broadcast.
 *
 * Who raises it changes what comes out:
 *
 *  * **Admin** — the decider, so the meetings are created already `scheduled`
 *    and every parent is notified. [scheduledAt] is required.
 *  * **Teacher** — raises *requests* for their own classes, which the admin
 *    then schedules or declines. [scheduledAt] is ignored (there's no date
 *    until the office sets one).
 */
export class CreateClassPtmDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  classIds: string[];

  @IsString()
  @MaxLength(500)
  reason: string;

  /** Required when the admin calls the meeting; ignored for a teacher. */
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  responseNote?: string;
}
