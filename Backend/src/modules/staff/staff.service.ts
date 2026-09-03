import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { Staff, StaffDocument } from './schemas/staff.schema';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(Staff.name)
    private readonly staffModel: Model<StaffDocument>,
  ) {}

  async create(
    dto: CreateStaffDto,
    schoolId: string | null,
  ): Promise<Staff> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    return this.staffModel.create({ ...dto, schoolId });
  }

  async findAll(
    page = 1,
    limit = 20,
    schoolId: string | null,
  ): Promise<PaginatedResult<Staff>> {
    const skip = (page - 1) * limit;
    const filter = scopeFilter({}, schoolId);
    const [data, total] = await Promise.all([
      this.staffModel.find(filter).skip(skip).limit(limit).exec(),
      this.staffModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, schoolId: string | null): Promise<Staff> {
    const doc = await this.staffModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) {
      throw new NotFoundException('Staff not found');
    }
    return doc;
  }

  async update(
    id: string,
    dto: UpdateStaffDto,
    schoolId: string | null,
  ): Promise<Staff> {
    const doc = await this.staffModel
      .findOneAndUpdate(scopeFilter({ _id: id }, schoolId), dto, {
        new: true,
      })
      .exec();
    if (!doc) {
      throw new NotFoundException('Staff not found');
    }
    return doc;
  }

  async remove(id: string, schoolId: string | null): Promise<void> {
    const res = await this.staffModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) {
      throw new NotFoundException('Staff not found');
    }
  }
}
