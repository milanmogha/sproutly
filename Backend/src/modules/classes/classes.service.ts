import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { StudentsService } from '../students/students.service';
import { Student } from '../students/schemas/student.schema';
import { Class, ClassDocument } from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

export type ClassWithCount = Class & { enrolled: number };

// NOTE (cross-module dependency): countsByClass, countByClass, findByClass,
// setClass and findOne live in StudentsService (owned by another agent's
// multi-tenancy pass). This file calls them with a trailing `schoolId`
// argument to match the project-wide scoping convention; StudentsService is
// expected to grow that same trailing parameter on each of those methods.
// If a TS2554 "expected N arguments" error appears here, it means
// students.service.ts hasn't picked up its schoolId param yet — do not
// remove the argument here, just wait for that module's pass to land.
@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Class.name)
    private readonly classModel: Model<ClassDocument>,
    private readonly studentsService: StudentsService,
  ) {}

  async create(
    dto: CreateClassDto,
    schoolId: string | null,
  ): Promise<Class> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    const exists = await this.classModel.exists(
      scopeFilter(
        {
          name: dto.name,
          section: dto.section ?? 'A',
          academicYear: dto.academicYear,
        },
        schoolId,
      ),
    );
    if (exists) {
      throw new ConflictException(
        'A class with this name, section and year already exists',
      );
    }
    return this.classModel.create({ ...dto, schoolId });
  }

  async findAll(schoolId: string | null): Promise<ClassWithCount[]> {
    const [classes, counts] = await Promise.all([
      this.classModel
        .find(scopeFilter({}, schoolId))
        .sort({ academicYear: -1, name: 1, section: 1 })
        // Class teacher's name so the roster can show who's in charge.
        .populate('classTeacher', 'name')
        .exec(),
      this.studentsService.countsByClass(schoolId),
    ]);
    return classes.map((c) => ({
      ...c.toObject(),
      enrolled: counts[String(c._id)] ?? 0,
    }));
  }

  async findOne(id: string, schoolId: string | null): Promise<ClassWithCount> {
    const cls = await this.classModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .populate('classTeacher', 'name')
      .exec();
    if (!cls) {
      throw new NotFoundException('Class not found');
    }
    const enrolled = await this.studentsService.countByClass(id, schoolId);
    return { ...cls.toObject(), enrolled };
  }

  async update(
    id: string,
    dto: UpdateClassDto,
    schoolId: string | null,
  ): Promise<Class> {
    const cls = await this.classModel
      .findOneAndUpdate(scopeFilter({ _id: id }, schoolId), dto, {
        new: true,
        runValidators: true,
      })
      .exec();
    if (!cls) {
      throw new NotFoundException('Class not found');
    }
    return cls;
  }

  async remove(id: string, schoolId: string | null): Promise<void> {
    const enrolled = await this.studentsService.countByClass(id, schoolId);
    if (enrolled > 0) {
      throw new ConflictException(
        `Cannot delete a class with ${enrolled} allocated student(s)`,
      );
    }
    const res = await this.classModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) {
      throw new NotFoundException('Class not found');
    }
  }

  listStudents(id: string, schoolId: string | null): Promise<Student[]> {
    return this.studentsService.findByClass(id, schoolId);
  }

  async allocateStudent(
    id: string,
    studentId: string,
    schoolId: string | null,
  ): Promise<Student> {
    const cls = await this.classModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!cls) {
      throw new NotFoundException('Class not found');
    }
    const enrolled = await this.studentsService.countByClass(id, schoolId);
    if (enrolled >= cls.capacity) {
      throw new BadRequestException(
        `Class is at full capacity (${cls.capacity})`,
      );
    }
    return this.studentsService.setClass(studentId, id, schoolId);
  }

  async deallocateStudent(
    id: string,
    studentId: string,
    schoolId: string | null,
  ): Promise<Student> {
    const student = await this.studentsService.findOne(studentId, schoolId);
    if (String(student.classId ?? '') !== id) {
      throw new BadRequestException('Student is not allocated to this class');
    }
    return this.studentsService.setClass(studentId, null, schoolId);
  }

  // ── Class-teacher helpers (used by leave approval) ──────

  /** Ids of the classes this user is the class teacher of. */
  async classIdsForTeacher(
    teacherId: string,
    schoolId: string | null,
  ): Promise<string[]> {
    const classes = await this.classModel
      .find(
        scopeFilter(
          { classTeacher: new Types.ObjectId(teacherId) },
          schoolId,
        ),
      )
      .select('_id')
      .exec();
    return classes.map((c) => String(c._id));
  }

  /** Ids of all students in the classes this user teaches. */
  async studentIdsForTeacher(
    teacherId: string,
    schoolId: string | null,
  ): Promise<string[]> {
    const classIds = await this.classIdsForTeacher(teacherId, schoolId);
    return this.studentsService.idsByClasses(classIds, schoolId);
  }

  /** True when [teacherId] is the class teacher of [studentId]'s class. */
  async isClassTeacherOfStudent(
    teacherId: string,
    studentId: string,
    schoolId: string | null,
  ): Promise<boolean> {
    const student = await this.studentsService
      .findOne(studentId, schoolId)
      .catch(() => null);
    const classId = student?.classId;
    if (!classId) return false;
    const cls = await this.classModel
      .findOne(scopeFilter({ _id: classId }, schoolId))
      .select('classTeacher')
      .exec();
    return (
      !!cls?.classTeacher && String(cls.classTeacher) === String(teacherId)
    );
  }
}
