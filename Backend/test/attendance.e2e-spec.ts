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
import { StudentAttendance } from './../src/modules/attendance/schemas/student-attendance.schema';

/**
 * Exercises the attendance module: create a class + two students, allocate
 * them, mark the day, verify the summary, check-in, and pull the monthly
 * report. Cleans up all created data.
 */
describe('Attendance (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let classModel: Model<Class>;
  let studentModel: Model<Student>;
  let attModel: Model<StudentAttendance>;
  let classId = '';
  const studentIds: string[] = [];
  const DATE = '2026-06-01';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new AppValidationPipe());
    await app.init();

    classModel = moduleFixture.get(getModelToken(Class.name));
    studentModel = moduleFixture.get(getModelToken(Student.name));
    attModel = moduleFixture.get(getModelToken(StudentAttendance.name));

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(superAdminCredentials());
    token = login.body?.data?.accessToken;

    const cls = await request(app.getHttpServer())
      .post('/api/classes')
      .set({ Authorization: `Bearer ${token}` })
      .send({ name: 'Att Grade', section: 'A', academicYear: '2026-2027' });
    classId = cls.body.data._id;

    for (const name of ['One', 'Two']) {
      const s = await request(app.getHttpServer())
        .post('/api/students')
        .set({ Authorization: `Bearer ${token}` })
        .send({
          firstName: `Att${name}`,
          lastName: 'Pupil',
          dateOfBirth: '2021-01-01',
          gender: 'other',
        });
      const id = s.body.data._id;
      studentIds.push(id);
      await request(app.getHttpServer())
        .post(`/api/classes/${classId}/allocate`)
        .set({ Authorization: `Bearer ${token}` })
        .send({ studentId: id });
    }
  });

  afterAll(async () => {
    await attModel.deleteMany({ student: { $in: studentIds } }).exec();
    await studentModel.deleteMany({ _id: { $in: studentIds } }).exec();
    if (classId) await classModel.findByIdAndDelete(classId).exec();
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('marks the class for a day and returns a summary', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/attendance/mark')
      .set(auth())
      .send({
        classId,
        date: DATE,
        entries: [
          { studentId: studentIds[0], status: 'present' },
          { studentId: studentIds[1], status: 'late', remarks: 'Bus delay' },
        ],
      })
      .expect(201);

    expect(res.body.data.total).toBe(2);
    expect(res.body.data.marked).toBe(2);
    expect(res.body.data.byStatus.present).toBe(1);
    expect(res.body.data.byStatus.late).toBe(1);
  });

  it('returns a class sheet merging roster with records', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/attendance/class/${classId}?date=${DATE}`)
      .set(auth())
      .expect(200);
    expect(res.body.data).toHaveLength(2);
    const statuses = res.body.data.map((r: { status: string }) => r.status);
    expect(statuses).toContain('present');
    expect(statuses).toContain('late');
  });

  it('lists late arrivals', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/attendance/class/${classId}/late?date=${DATE}`)
      .set(auth())
      .expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('records a check-in time (idempotent upsert)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/attendance/check-in-out')
      .set(auth())
      .send({ studentId: studentIds[0], action: 'check_in', date: DATE })
      .expect(201);
    expect(res.body.data.checkInAt).toBeTruthy();
  });

  it('produces a monthly report', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/attendance/student/${studentIds[0]}/monthly?year=2026&month=6`)
      .set(auth())
      .expect(200);
    expect(res.body.data.summary.present).toBe(1);
    expect(res.body.data.days.length).toBe(1);
  });

  it('re-marking the same day updates rather than duplicates', async () => {
    await request(app.getHttpServer())
      .post('/api/attendance/mark')
      .set(auth())
      .send({
        classId,
        date: DATE,
        entries: [{ studentId: studentIds[1], status: 'absent' }],
      })
      .expect(201);

    // The sheet still has exactly one row per student, with the updated status.
    const sheet = await request(app.getHttpServer())
      .get(`/api/attendance/class/${classId}?date=${DATE}`)
      .set(auth())
      .expect(200);
    expect(sheet.body.data).toHaveLength(2);
    const s2 = sheet.body.data.find(
      (r: { student: { _id: string } }) => r.student._id === studentIds[1],
    );
    expect(s2.status).toBe('absent');
  });
});
