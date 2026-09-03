import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model, Types } from 'mongoose';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import { StudentsService } from '../students/students.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Assessment, AssessmentDocument } from './schemas/assessment.schema';
import { Result, ResultDocument } from './schemas/result.schema';
import { Homework, HomeworkDocument } from './schemas/homework.schema';
import { Syllabus, SyllabusDocument } from './schemas/syllabus.schema';
import { LessonPlan, LessonPlanDocument } from './schemas/lesson-plan.schema';
import {
  Milestone,
  MilestoneDocument,
  MilestoneStatus,
} from './schemas/milestone.schema';
import {
  TeacherRemark,
  TeacherRemarkDocument,
} from './schemas/teacher-remark.schema';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { EnterResultDto } from './dto/enter-result.dto';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { CreateSyllabusDto } from './dto/create-syllabus.dto';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import {
  CreateMilestoneDto,
  UpdateMilestoneStatusDto,
} from './dto/create-milestone.dto';
import { CreateTeacherRemarkDto } from './dto/create-teacher-remark.dto';

@Injectable()
export class AcademicService {
  constructor(
    @InjectModel(Assessment.name)
    private readonly assessmentModel: Model<AssessmentDocument>,
    @InjectModel(Result.name)
    private readonly resultModel: Model<ResultDocument>,
    @InjectModel(Homework.name)
    private readonly homeworkModel: Model<HomeworkDocument>,
    @InjectModel(Syllabus.name)
    private readonly syllabusModel: Model<SyllabusDocument>,
    @InjectModel(LessonPlan.name)
    private readonly lessonPlanModel: Model<LessonPlanDocument>,
    @InjectModel(Milestone.name)
    private readonly milestoneModel: Model<MilestoneDocument>,
    @InjectModel(TeacherRemark.name)
    private readonly remarkModel: Model<TeacherRemarkDocument>,
    private readonly studentsService: StudentsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Assessments ─────────────────────────────────────────

  createAssessment(
    dto: CreateAssessmentDto,
    createdBy: string,
    schoolId: string | null,
  ): Promise<Assessment> {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    return this.assessmentModel.create({
      ...dto,
      classId: new Types.ObjectId(dto.classId),
      date: new Date(dto.date),
      createdBy: new Types.ObjectId(createdBy),
      schoolId,
    });
  }

  assessmentsByClass(
    classId: string,
    subject: string | undefined,
    schoolId: string | null,
  ): Promise<Assessment[]> {
    const filter: Record<string, unknown> = {
      classId: new Types.ObjectId(classId),
    };
    if (subject) filter.subject = subject;
    return this.assessmentModel
      .find(scopeFilter(filter, schoolId))
      .sort({ date: -1 })
      .exec();
  }

  async getAssessment(
    id: string,
    schoolId: string | null,
  ): Promise<Assessment> {
    const doc = await this.assessmentModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) throw new NotFoundException('Assessment not found');
    return doc;
  }

  async removeAssessment(id: string, schoolId: string | null): Promise<void> {
    const res = await this.assessmentModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) throw new NotFoundException('Assessment not found');
    await this.resultModel
      .deleteMany(
        scopeFilter({ assessment: new Types.ObjectId(id) }, schoolId),
      )
      .exec();
  }

  // ── Results ─────────────────────────────────────────────

  async enterResults(
    dto: EnterResultDto,
    recordedBy: string,
    schoolId: string | null,
  ): Promise<Result[]> {
    const assessment = await this.assessmentModel
      .findOne(scopeFilter({ _id: dto.assessmentId }, schoolId))
      .exec();
    if (!assessment) throw new NotFoundException('Assessment not found');

    const assessmentId = new Types.ObjectId(dto.assessmentId);
    const ops: AnyBulkWriteOperation<ResultDocument>[] = dto.entries.map(
      (e) => ({
        updateOne: {
          filter: {
            assessment: assessmentId,
            student: new Types.ObjectId(e.studentId),
          },
          update: {
            $set: {
              score: Math.min(e.score, assessment.maxScore),
              grade: e.grade ?? null,
              remarks: e.remarks ?? null,
              recordedBy: new Types.ObjectId(recordedBy),
            },
            $setOnInsert: { schoolId: assessment.schoolId },
          },
          upsert: true,
        },
      }),
    );
    await this.resultModel.bulkWrite(ops);
    return this.resultsByAssessment(dto.assessmentId, schoolId);
  }

  resultsByAssessment(
    assessmentId: string,
    schoolId: string | null,
  ): Promise<Result[]> {
    return this.resultModel
      .find(
        scopeFilter({ assessment: new Types.ObjectId(assessmentId) }, schoolId),
      )
      .exec();
  }

  /** A student's results across assessments — the "child progress" view. */
  studentProgress(
    studentId: string,
    schoolId: string | null,
  ): Promise<Result[]> {
    return this.resultModel
      .find(scopeFilter({ student: new Types.ObjectId(studentId) }, schoolId))
      .populate('assessment', 'title subject maxScore date type')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ── Homework ────────────────────────────────────────────

  async createHomework(
    dto: CreateHomeworkDto,
    createdBy: string,
    schoolId: string | null,
  ): Promise<Homework> {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    const homework = await this.homeworkModel.create({
      ...dto,
      classId: new Types.ObjectId(dto.classId),
      assignedDate: dto.assignedDate ? new Date(dto.assignedDate) : new Date(),
      dueDate: new Date(dto.dueDate),
      createdBy: new Types.ObjectId(createdBy),
      schoolId,
    });

    // Every parent in the class hears about it, minus those who opted out.
    const roster = await this.studentsService.findByClass(dto.classId, schoolId);
    const parents = roster
      .map((s) => s.parentUserId)
      .filter((p): p is Types.ObjectId => !!p)
      .map(String);
    const due = new Date(dto.dueDate).toDateString();
    await this.notifications.sendMany(
      parents,
      {
        title: `New homework: ${dto.subject}`,
        body: `${dto.title} — due ${due}.`,
        type: 'homework',
        data: {
          homeworkId: String(homework._id),
          classId: dto.classId,
          dueDate: due,
        },
      },
      schoolId,
      'homeworkNotifications',
    );
    return homework;
  }

  homeworkByClass(
    classId: string,
    schoolId: string | null,
  ): Promise<Homework[]> {
    return this.homeworkModel
      .find(scopeFilter({ classId: new Types.ObjectId(classId) }, schoolId))
      .sort({ assignedDate: -1 })
      .exec();
  }

  async removeHomework(id: string, schoolId: string | null): Promise<void> {
    const res = await this.homeworkModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) throw new NotFoundException('Homework not found');
  }

  // ── Syllabus ────────────────────────────────────────────

  async upsertSyllabus(
    dto: CreateSyllabusDto,
    createdBy: string,
    schoolId: string | null,
  ): Promise<Syllabus> {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    const doc = await this.syllabusModel
      .findOneAndUpdate(
        scopeFilter(
          {
            classId: new Types.ObjectId(dto.classId),
            subject: dto.subject,
            academicYear: dto.academicYear,
          },
          schoolId,
        ),
        {
          $set: { units: dto.units ?? [] },
          $setOnInsert: { createdBy: new Types.ObjectId(createdBy), schoolId },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
    return doc;
  }

  syllabusByClass(
    classId: string,
    schoolId: string | null,
  ): Promise<Syllabus[]> {
    return this.syllabusModel
      .find(scopeFilter({ classId: new Types.ObjectId(classId) }, schoolId))
      .sort({ subject: 1 })
      .exec();
  }

  // ── Lesson plans ────────────────────────────────────────

  createLessonPlan(
    dto: CreateLessonPlanDto,
    createdBy: string,
    schoolId: string | null,
  ): Promise<LessonPlan> {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    return this.lessonPlanModel.create({
      ...dto,
      classId: new Types.ObjectId(dto.classId),
      date: new Date(dto.date),
      createdBy: new Types.ObjectId(createdBy),
      schoolId,
    });
  }

  lessonPlansByClass(
    classId: string,
    schoolId: string | null,
  ): Promise<LessonPlan[]> {
    return this.lessonPlanModel
      .find(scopeFilter({ classId: new Types.ObjectId(classId) }, schoolId))
      .sort({ date: -1 })
      .exec();
  }

  // ── Milestones ──────────────────────────────────────────

  createMilestone(
    dto: CreateMilestoneDto,
    recordedBy: string,
    schoolId: string | null,
  ): Promise<Milestone> {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    const achieved = dto.status === MilestoneStatus.ACHIEVED;
    return this.milestoneModel.create({
      ...dto,
      student: new Types.ObjectId(dto.studentId),
      achievedDate: achieved ? new Date() : null,
      recordedBy: new Types.ObjectId(recordedBy),
      schoolId,
    });
  }

  milestonesByStudent(
    studentId: string,
    schoolId: string | null,
  ): Promise<Milestone[]> {
    return this.milestoneModel
      .find(scopeFilter({ student: new Types.ObjectId(studentId) }, schoolId))
      .sort({ category: 1, createdAt: 1 })
      .exec();
  }

  async updateMilestoneStatus(
    id: string,
    dto: UpdateMilestoneStatusDto,
    schoolId: string | null,
  ): Promise<Milestone> {
    const patch: Record<string, unknown> = { status: dto.status };
    if (dto.notes !== undefined) patch.notes = dto.notes;
    patch.achievedDate =
      dto.status === MilestoneStatus.ACHIEVED ? new Date() : null;

    const doc = await this.milestoneModel
      .findOneAndUpdate(scopeFilter({ _id: id }, schoolId), patch, {
        new: true,
      })
      .exec();
    if (!doc) throw new NotFoundException('Milestone not found');
    return doc;
  }

  // ── Teacher remarks ─────────────────────────────────────

  createRemark(
    dto: CreateTeacherRemarkDto,
    recordedBy: string,
    schoolId: string | null,
  ): Promise<TeacherRemark> {
    if (!schoolId) throw new BadRequestException('schoolId is required');
    return this.remarkModel.create({
      ...dto,
      student: new Types.ObjectId(dto.studentId),
      recordedBy: new Types.ObjectId(recordedBy),
      schoolId,
    });
  }

  remarksByStudent(
    studentId: string,
    schoolId: string | null,
  ): Promise<TeacherRemark[]> {
    return this.remarkModel
      .find(scopeFilter({ student: new Types.ObjectId(studentId) }, schoolId))
      .sort({ date: -1 })
      .exec();
  }
}
