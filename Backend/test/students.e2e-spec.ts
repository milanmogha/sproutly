import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from './../src/app.module';
import { superAdminCredentials } from './../src/database/seeders/super-admin.credentials';
import { AppValidationPipe } from './../src/common/pipes/validation.pipe';
import { Student } from './../src/modules/students/schemas/student.schema';

/**
 * Exercises the students module end-to-end. Logs in as the seeded
 * super-admin to obtain a token, then drives the full CRUD surface.
 * Requires the super-admin seed (npm run seed) and a running MongoDB.
 */
describe('Students (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let studentModel: Model<Student>;
  const created: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new AppValidationPipe());
    await app.init();

    studentModel = moduleFixture.get<Model<Student>>(
      getModelToken(Student.name),
    );

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(superAdminCredentials());
    token = res.body?.data?.accessToken;
  });

  afterAll(async () => {
    if (created.length) {
      await studentModel.deleteMany({ _id: { $in: created } }).exec();
    }
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('logs in as super-admin and gets a token', () => {
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });

  it('requires authentication', () => {
    return request(app.getHttpServer()).get('/api/students').expect(401);
  });

  it('rejects an invalid payload (validation)', () => {
    return request(app.getHttpServer())
      .post('/api/students')
      .set(auth())
      .send({ firstName: 'NoLastName', gender: 'martian' })
      .expect(400);
  });

  it('creates a student and auto-generates an admission number', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/students')
      .set(auth())
      .send({
        firstName: 'Aria',
        lastName: 'Khan',
        dateOfBirth: '2020-05-14',
        gender: 'female',
        guardians: [
          {
            name: 'Sara Khan',
            relationship: 'mother',
            phone: '+1 555-0100',
            isPrimary: true,
          },
        ],
        medicalInfo: { bloodGroup: 'O+', allergies: ['peanuts'] },
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    const student = res.body.data;
    expect(student.admissionNumber).toMatch(/^ADM-\d{4}-\d{5}$/);
    expect(student.fullName).toBe('Aria Khan');
    expect(student.guardians).toHaveLength(1);
    expect(student.medicalInfo.bloodGroup).toBe('O+');
    created.push(student._id);
  });

  it('finds the student via search', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/students?search=Aria')
      .set(auth())
      .expect(200);
    const found = res.body.data.data.find((s: { _id: string }) =>
      created.includes(s._id),
    );
    expect(found).toBeDefined();
  });

  it('adds a guardian to the student', async () => {
    const id = created[0];
    const res = await request(app.getHttpServer())
      .post(`/api/students/${id}/guardians`)
      .set(auth())
      .send({ name: 'Imran Khan', relationship: 'father', phone: '555-0200' })
      .expect(201);
    expect(res.body.data.guardians).toHaveLength(2);
  });

  it('returns stats including the new status counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/students/stats')
      .set(auth())
      .expect(200);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data.byStatus).toHaveProperty('active');
  });

  it('deletes the student', async () => {
    const id = created[0];
    await request(app.getHttpServer())
      .delete(`/api/students/${id}`)
      .set(auth())
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/students/${id}`)
      .set(auth())
      .expect(404);
    created.length = 0;
  });
});
