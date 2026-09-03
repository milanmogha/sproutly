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

/**
 * Exercises the classes module + student allocation end-to-end.
 * Requires the super-admin seed and a running MongoDB.
 */
describe('Classes (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let classModel: Model<Class>;
  let studentModel: Model<Student>;
  let classId = '';
  let studentId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new AppValidationPipe());
    await app.init();

    classModel = moduleFixture.get<Model<Class>>(getModelToken(Class.name));
    studentModel = moduleFixture.get<Model<Student>>(
      getModelToken(Student.name),
    );

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(superAdminCredentials());
    token = res.body?.data?.accessToken;
  });

  afterAll(async () => {
    if (studentId) await studentModel.findByIdAndDelete(studentId).exec();
    if (classId) await classModel.findByIdAndDelete(classId).exec();
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('rejects an invalid academicYear (validation)', () => {
    return request(app.getHttpServer())
      .post('/api/classes')
      .set(auth())
      .send({ name: 'Grade Z', academicYear: 'not-a-year' })
      .expect(400);
  });

  it('creates a class with capacity 1', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/classes')
      .set(auth())
      .send({
        name: 'E2E Grade',
        section: 'Z',
        academicYear: '2025-2026',
        capacity: 1,
      })
      .expect(201);
    classId = res.body.data._id;
    expect(res.body.data.displayName).toBe('E2E Grade - Z');
  });

  it('rejects a duplicate class (name+section+year)', () => {
    return request(app.getHttpServer())
      .post('/api/classes')
      .set(auth())
      .send({
        name: 'E2E Grade',
        section: 'Z',
        academicYear: '2025-2026',
      })
      .expect(409);
  });

  it('allocates a student and reflects the count', async () => {
    const studentRes = await request(app.getHttpServer())
      .post('/api/students')
      .set(auth())
      .send({
        firstName: 'Alloc',
        lastName: 'Tester',
        dateOfBirth: '2021-01-01',
        gender: 'other',
      })
      .expect(201);
    studentId = studentRes.body.data._id;

    await request(app.getHttpServer())
      .post(`/api/classes/${classId}/allocate`)
      .set(auth())
      .send({ studentId })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/classes/${classId}`)
      .set(auth())
      .expect(200);
    expect(detail.body.data.enrolled).toBe(1);
  });

  it('enforces capacity (class is full)', async () => {
    const s2 = await request(app.getHttpServer())
      .post('/api/students')
      .set(auth())
      .send({
        firstName: 'Overflow',
        lastName: 'Tester',
        dateOfBirth: '2021-02-02',
        gender: 'other',
      })
      .expect(201);
    const s2Id = s2.body.data._id;

    await request(app.getHttpServer())
      .post(`/api/classes/${classId}/allocate`)
      .set(auth())
      .send({ studentId: s2Id })
      .expect(400);

    await studentModel.findByIdAndDelete(s2Id).exec();
  });

  it('blocks deleting a class that still has students (409)', () => {
    return request(app.getHttpServer())
      .delete(`/api/classes/${classId}`)
      .set(auth())
      .expect(409);
  });

  it('deallocates the student, then allows class deletion', async () => {
    await request(app.getHttpServer())
      .delete(`/api/classes/${classId}/students/${studentId}`)
      .set(auth())
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/classes/${classId}`)
      .set(auth())
      .expect(200);
    classId = '';
  });
});
