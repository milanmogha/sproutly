import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { UserRole } from '../../common/enums/user-role.enum';
import { Vehicle, VehicleDocument } from './schemas/vehicle.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class TransportService {
  constructor(
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
  ) {}

  /**
   * The one route this user is connected to, or null.
   *
   * A parent's connection is their child: resolve their children, then match
   * on `assignedStudents`. Everyone else rides as staff, so match their own id
   * against `assignedStaff`. Neither may see the whole fleet — that is what
   * `findAll` is for, and it is admin-only.
   */
  async findForUser(
    userId: string,
    role: string,
    schoolId: string | null,
  ): Promise<Vehicle | null> {
    if (role === UserRole.PARENT) {
      const children = await this.studentModel
        .find(scopeFilter({ parentUserId: userId }, schoolId))
        .select('_id')
        .exec();
      if (!children.length) return null;
      const ids = children.map((child) => String(child._id));
      return this.vehicleModel
        .findOne(scopeFilter({ assignedStudents: { $in: ids } }, schoolId))
        .exec();
    }
    return this.vehicleModel
      .findOne(scopeFilter({ assignedStaff: userId }, schoolId))
      .exec();
  }

  async create(
    dto: CreateVehicleDto,
    schoolId: string | null,
  ): Promise<Vehicle> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    return this.vehicleModel.create({ ...dto, schoolId });
  }

  async findAll(
    page = 1,
    limit = 20,
    schoolId: string | null,
  ): Promise<PaginatedResult<Vehicle>> {
    const skip = (page - 1) * limit;
    const filter = scopeFilter({}, schoolId);
    const [data, total] = await Promise.all([
      this.vehicleModel.find(filter).skip(skip).limit(limit).exec(),
      this.vehicleModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, schoolId: string | null): Promise<Vehicle> {
    const doc = await this.vehicleModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) {
      throw new NotFoundException('Vehicle not found');
    }
    return doc;
  }

  async update(
    id: string,
    dto: CreateVehicleDto,
    schoolId: string | null,
  ): Promise<Vehicle> {
    const doc = await this.vehicleModel
      .findOneAndUpdate(scopeFilter({ _id: id }, schoolId), dto, {
        new: true,
      })
      .exec();
    if (!doc) {
      throw new NotFoundException('Vehicle not found');
    }
    return doc;
  }

  async remove(id: string, schoolId: string | null): Promise<void> {
    const res = await this.vehicleModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) {
      throw new NotFoundException('Vehicle not found');
    }
  }

  async assignStudent(
    id: string,
    studentId: string,
    schoolId: string | null,
  ): Promise<Vehicle> {
    const doc = await this.vehicleModel
      .findOneAndUpdate(
        scopeFilter({ _id: id }, schoolId),
        { $addToSet: { assignedStudents: studentId } },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Vehicle not found');
    return doc;
  }

  async unassignStudent(
    id: string,
    studentId: string,
    schoolId: string | null,
  ): Promise<Vehicle> {
    const doc = await this.vehicleModel
      .findOneAndUpdate(
        scopeFilter({ _id: id }, schoolId),
        { $pull: { assignedStudents: studentId } },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Vehicle not found');
    return doc;
  }

  async assignStaff(
    id: string,
    staffId: string,
    schoolId: string | null,
  ): Promise<Vehicle> {
    const doc = await this.vehicleModel
      .findOneAndUpdate(
        scopeFilter({ _id: id }, schoolId),
        { $addToSet: { assignedStaff: staffId } },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Vehicle not found');
    return doc;
  }

  async unassignStaff(
    id: string,
    staffId: string,
    schoolId: string | null,
  ): Promise<Vehicle> {
    const doc = await this.vehicleModel
      .findOneAndUpdate(
        scopeFilter({ _id: id }, schoolId),
        { $pull: { assignedStaff: staffId } },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Vehicle not found');
    return doc;
  }
}
