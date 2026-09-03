import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { StudentsService } from '../students/students.service';
import { MealUpdate, MealUpdateDocument } from './schemas/meal-update.schema';
import { NapUpdate, NapUpdateDocument } from './schemas/nap-update.schema';
import {
  ActivityLog,
  ActivityLogDocument,
} from './schemas/activity-log.schema';
import {
  HealthUpdate,
  HealthUpdateDocument,
} from './schemas/health-update.schema';
import {
  BehavioralObservation,
  BehavioralObservationDocument,
} from './schemas/behavioral-observation.schema';
import { CreateMealUpdateDto } from './dto/create-meal-update.dto';
import { CreateNapUpdateDto } from './dto/create-nap-update.dto';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { CreateHealthUpdateDto } from './dto/create-health-update.dto';
import { CreateBehavioralObservationDto } from './dto/create-behavioral-observation.dto';

export type DaycareEntryType =
  'meals' | 'naps' | 'activities' | 'health' | 'observations';

@Injectable()
export class DaycareService {
  constructor(
    @InjectModel(MealUpdate.name)
    private readonly mealModel: Model<MealUpdateDocument>,
    @InjectModel(NapUpdate.name)
    private readonly napModel: Model<NapUpdateDocument>,
    @InjectModel(ActivityLog.name)
    private readonly activityModel: Model<ActivityLogDocument>,
    @InjectModel(HealthUpdate.name)
    private readonly healthModel: Model<HealthUpdateDocument>,
    @InjectModel(BehavioralObservation.name)
    private readonly observationModel: Model<BehavioralObservationDocument>,
    private readonly studentsService: StudentsService,
  ) {}

  // ── Meals ───────────────────────────────────────────────

  async createMeal(
    dto: CreateMealUpdateDto,
    recordedBy: string,
    schoolId: string | null,
  ): Promise<MealUpdate> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const { date, classId } = await this.context(
      dto.studentId,
      dto.date,
      schoolId,
    );
    return this.mealModel.create({
      student: new Types.ObjectId(dto.studentId),
      classId,
      date,
      mealType: dto.mealType,
      menu: dto.menu,
      amountEaten: dto.amountEaten,
      notes: dto.notes ?? null,
      recordedBy: new Types.ObjectId(recordedBy),
      schoolId,
    });
  }

  // ── Naps ────────────────────────────────────────────────

  async createNap(
    dto: CreateNapUpdateDto,
    recordedBy: string,
    schoolId: string | null,
  ): Promise<NapUpdate> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const { date, classId } = await this.context(
      dto.studentId,
      dto.date,
      schoolId,
    );
    const startTime = dto.startTime ? new Date(dto.startTime) : null;
    const endTime = dto.endTime ? new Date(dto.endTime) : null;
    const durationMinutes =
      startTime && endTime
        ? Math.max(
            0,
            Math.round((endTime.getTime() - startTime.getTime()) / 60000),
          )
        : 0;

    return this.napModel.create({
      student: new Types.ObjectId(dto.studentId),
      classId,
      date,
      startTime,
      endTime,
      durationMinutes,
      quality: dto.quality,
      notes: dto.notes ?? null,
      recordedBy: new Types.ObjectId(recordedBy),
      schoolId,
    });
  }

  // ── Activities ──────────────────────────────────────────

  async createActivity(
    dto: CreateActivityLogDto,
    recordedBy: string,
    schoolId: string | null,
  ): Promise<ActivityLog> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const { date, classId } = await this.context(
      dto.studentId,
      dto.date,
      schoolId,
    );
    return this.activityModel.create({
      student: new Types.ObjectId(dto.studentId),
      classId,
      date,
      title: dto.title,
      category: dto.category,
      description: dto.description ?? null,
      photos: dto.photos ?? [],
      notes: dto.notes ?? null,
      recordedBy: new Types.ObjectId(recordedBy),
      schoolId,
    });
  }

  // ── Health ──────────────────────────────────────────────

  async createHealth(
    dto: CreateHealthUpdateDto,
    recordedBy: string,
    schoolId: string | null,
  ): Promise<HealthUpdate> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const { date, classId } = await this.context(
      dto.studentId,
      dto.date,
      schoolId,
    );
    return this.healthModel.create({
      student: new Types.ObjectId(dto.studentId),
      classId,
      date,
      type: dto.type,
      description: dto.description,
      temperature: dto.temperature ?? null,
      medication: dto.medication ?? null,
      severity: dto.severity,
      notes: dto.notes ?? null,
      recordedBy: new Types.ObjectId(recordedBy),
      schoolId,
    });
  }

  // ── Behavioral observations ─────────────────────────────

  async createObservation(
    dto: CreateBehavioralObservationDto,
    recordedBy: string,
    schoolId: string | null,
  ): Promise<BehavioralObservation> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const { date, classId } = await this.context(
      dto.studentId,
      dto.date,
      schoolId,
    );
    return this.observationModel.create({
      student: new Types.ObjectId(dto.studentId),
      classId,
      date,
      mood: dto.mood,
      observation: dto.observation,
      context: dto.context ?? null,
      notes: dto.notes ?? null,
      recordedBy: new Types.ObjectId(recordedBy),
      schoolId,
    });
  }

  // ── Reads ───────────────────────────────────────────────

  meals(studentId: string, date: string | undefined, schoolId: string | null) {
    return this.mealModel
      .find(scopeFilter(this.scope(studentId, date), schoolId))
      .sort({ date: -1 })
      .exec();
  }
  naps(studentId: string, date: string | undefined, schoolId: string | null) {
    return this.napModel
      .find(scopeFilter(this.scope(studentId, date), schoolId))
      .sort({ date: -1 })
      .exec();
  }
  activities(
    studentId: string,
    date: string | undefined,
    schoolId: string | null,
  ) {
    return this.activityModel
      .find(scopeFilter(this.scope(studentId, date), schoolId))
      .sort({ date: -1 })
      .exec();
  }
  health(
    studentId: string,
    date: string | undefined,
    schoolId: string | null,
  ) {
    return this.healthModel
      .find(scopeFilter(this.scope(studentId, date), schoolId))
      .sort({ date: -1 })
      .exec();
  }
  observations(
    studentId: string,
    date: string | undefined,
    schoolId: string | null,
  ) {
    return this.observationModel
      .find(scopeFilter(this.scope(studentId, date), schoolId))
      .sort({ date: -1 })
      .exec();
  }

  /** The digital preschool diary: everything logged for a student on a day. */
  async diary(studentId: string, dateStr: string | undefined, schoolId: string | null) {
    const date = this.toDay(dateStr);
    const filter = scopeFilter(
      { student: new Types.ObjectId(studentId), date },
      schoolId,
    );
    const [meals, naps, activities, health, observations] = await Promise.all([
      this.mealModel.find(filter).sort({ createdAt: 1 }).exec(),
      this.napModel.find(filter).sort({ createdAt: 1 }).exec(),
      this.activityModel.find(filter).sort({ createdAt: 1 }).exec(),
      this.healthModel.find(filter).sort({ createdAt: 1 }).exec(),
      this.observationModel.find(filter).sort({ createdAt: 1 }).exec(),
    ]);
    return {
      studentId,
      date: date.toISOString().slice(0, 10),
      meals,
      naps,
      activities,
      health,
      observations,
    };
  }

  async remove(
    type: DaycareEntryType,
    id: string,
    schoolId: string | null,
  ): Promise<void> {
    const result = await this.modelFor(type)
      .findOneAndDelete({ _id: id, ...(schoolId ? { schoolId } : {}) })
      .exec();
    if (!result) {
      throw new NotFoundException('Daycare entry not found');
    }
  }

  // ── helpers ─────────────────────────────────────────────

  private async context(
    studentId: string,
    dateStr: string | undefined,
    schoolId: string | null,
  ): Promise<{ date: Date; classId: Types.ObjectId | null }> {
    const student = await this.studentsService.findOne(studentId, schoolId);
    return {
      date: this.toDay(dateStr),
      classId: (student.classId as Types.ObjectId | null) ?? null,
    };
  }

  private scope(studentId: string, dateStr?: string) {
    const filter: { student: Types.ObjectId; date?: Date } = {
      student: new Types.ObjectId(studentId),
    };
    if (dateStr) filter.date = this.toDay(dateStr);
    return filter;
  }

  private modelFor(type: DaycareEntryType): Model<{ _id: Types.ObjectId }> {
    switch (type) {
      case 'meals':
        return this.mealModel as unknown as Model<{ _id: Types.ObjectId }>;
      case 'naps':
        return this.napModel as unknown as Model<{ _id: Types.ObjectId }>;
      case 'activities':
        return this.activityModel as unknown as Model<{ _id: Types.ObjectId }>;
      case 'health':
        return this.healthModel as unknown as Model<{ _id: Types.ObjectId }>;
      case 'observations':
        return this.observationModel as unknown as Model<{
          _id: Types.ObjectId;
        }>;
      default:
        throw new BadRequestException('Unknown daycare entry type');
    }
  }

  private toDay(dateStr?: string): Date {
    const d = dateStr ? new Date(dateStr) : new Date();
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }
}
