import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from './../src/app.module';
import { superAdminCredentials } from './../src/database/seeders/super-admin.credentials';
import { AppValidationPipe } from './../src/common/pipes/validation.pipe';
import { Class } from './../src/modules/classes/schemas/class.schema';
import { Student } from './../src/modules/students/schemas/student.schema';
import { Assessment } from './../src/modules/academic/schemas/assessment.schema';
import { Result } from './../src/modules/academic/schemas/result.schema';
import { Homework } from './../src/modules/academic/schemas/homework.schema';
import { Milestone } from './../src/modules/academic/schemas/milestone.schema';
import { TeacherRemark } from './../src/modules/academic/schemas/teacher-remark.schema';

describe('Academic (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const models: Record<string, Model<unknown>> = {};
  let classId = '';
  let studentId = '';
  let assessmentId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new AppValidationPipe());
    await app.init();

    for (const name of [
      Class.name,
      Student.name,
      Assessment.name,
      Result.name,
      Homework.name,
      Milestone.name,
      TeacherRemark.name,
    ]) {
      models[name] = moduleFixture.get(getModelToken(name));
    }

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(superAdminCredentials());
    token = login.body?.data?.accessToken;

    const cls = await request(app.getHttpServer())
      .post('/api/classes')
      .set({ Authorization: `Bearer ${token}` })
      .send({ name: 'Acad Grade', section: 'A', academicYear: '2026-2027' });
    classId = cls.body.data._id;

    const s = await request(app.getHttpServer())
      .post('/api/students')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        firstName: 'Acad',
        lastName: 'Pupil',
        dateOfBirth: '2021-01-01',
        gender: 'male',
      });
    studentId = s.body.data._id;
  });

  afterAll(async () => {
    await models[Result.name]
      .deleteMany({ student: studentId } as never)
      .exec();
    await models[Assessment.name].deleteMany({ classId } as never).exec();
    await models[Homework.name].deleteMany({ classId } as never).exec();
    await models[Milestone.name]
      .deleteMany({ student: studentId } as never)
      .exec();
    await models[TeacherRemark.name]
      .deleteMany({ student: studentId } as never)
      .exec();
    await models[Student.name].findByIdAndDelete(studentId).exec();
    await models[Class.name].findByIdAndDelete(classId).exec();
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('creates an assessment', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/academic/assessments')
      .set(auth())
      .send({
        title: 'Colours quiz',
        subject: 'General',
        classId,
        type: 'quiz',
        maxScore: 10,
        date: '2026-06-10',
      })
      .expect(201);
    assessmentId = res.body.data._id;
    expect(res.body.data.maxScore).toBe(10);
  });

  it('enters results (capping score at maxScore)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/academic/results')
      .set(auth())
      .send({
        assessmentId,
        entries: [{ studentId, score: 25, grade: 'A', remarks: 'Great' }],
      })
      .expect(201);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].score).toBe(10); // capped at maxScore
  });

  it('re-entering results updates rather than duplicates', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/academic/results')
      .set(auth())
      .send({ assessmentId, entries: [{ studentId, score: 8 }] })
      .expect(201);
    // One result per (assessment, student) — still a single row, updated score.
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].score).toBe(8);
  });

  it('shows the student progress with populated assessment', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/academic/students/${studentId}/progress`)
      .set(auth())
      .expect(200);
    expect(res.body.data[0].assessment.title).toBe('Colours quiz');
  });

  it('creates homework for the class', async () => {
    await request(app.getHttpServer())
      .post('/api/academic/homework')
      .set(auth())
      .send({
        title: 'Draw your family',
        subject: 'Art',
        classId,
        dueDate: '2026-06-20',
      })
      .expect(201);
    const list = await request(app.getHttpServer())
      .get(`/api/academic/homework?classId=${classId}`)
      .set(auth())
      .expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it('tracks a milestone and updates its status', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/academic/milestones')
      .set(auth())
      .send({ studentId, title: 'Counts to 10', category: 'cognitive' })
      .expect(201);
    const id = created.body.data._id;

    const updated = await request(app.getHttpServer())
      .patch(`/api/academic/milestones/${id}`)
      .set(auth())
      .send({ status: 'achieved' })
      .expect(200);
    expect(updated.body.data.status).toBe('achieved');
    expect(updated.body.data.achievedDate).toBeTruthy();
  });

  it('records and lists a teacher remark', async () => {
    await request(app.getHttpServer())
      .post('/api/academic/remarks')
      .set(auth())
      .send({
        studentId,
        remark: 'Very curious learner',
        category: 'appreciation',
      })
      .expect(201);
    const list = await request(app.getHttpServer())
      .get(`/api/academic/students/${studentId}/remarks`)
      .set(auth())
      .expect(200);
    expect(list.body.data).toHaveLength(1);
  });
});
