import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MealAmount, MealType } from '../schemas/meal-update.schema';

export class CreateMealUpdateDto {
  @IsMongoId()
  studentId: string;

  /** Defaults to today. */
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsEnum(MealType)
  mealType: MealType;

  @IsString()
  @MaxLength(200)
  menu: string;

  @IsOptional()
  @IsEnum(MealAmount)
  amountEaten?: MealAmount;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
