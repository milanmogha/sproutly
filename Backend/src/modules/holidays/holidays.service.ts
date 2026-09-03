import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { Holiday, HolidayDocument } from './schemas/holiday.schema';
import { CreateHolidayDto } from './dto/create-holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(
    @InjectModel(Holiday.name)
    private readonly holidayModel: Model<HolidayDocument>,
  ) {}

  async create(
    dto: CreateHolidayDto,
    createdBy: string,
    schoolId: string | null,
  ): Promise<Holiday> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    try {
      return await this.holidayModel.create({
        title: dto.title,
        date: new Date(dto.date),
        description: dto.description ?? null,
        createdBy: new Types.ObjectId(createdBy),
        schoolId,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException(
          'A holiday is already marked for this date',
        );
      }
      throw err;
    }
  }

  /** Holidays for a school, optionally filtered to one calendar year and/or
   *  only upcoming (today onward). Sorted by date ascending. */
  findAll(
    schoolId: string | null,
    opts: { year?: number; upcoming?: boolean } = {},
  ): Promise<Holiday[]> {
    const filter: FilterQuery<HolidayDocument> = scopeFilter({}, schoolId);
    if (opts.year) {
      filter.date = {
        $gte: new Date(opts.year, 0, 1),
        $lte: new Date(opts.year, 11, 31, 23, 59, 59),
      };
    }
    if (opts.upcoming) {
      filter.date = {
        ...(filter.date as object),
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      };
    }
    return this.holidayModel.find(filter).sort({ date: 1 }).exec();
  }

  async remove(id: string, schoolId: string | null): Promise<void> {
    const res = await this.holidayModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) {
      throw new NotFoundException('Holiday not found');
    }
  }
}
