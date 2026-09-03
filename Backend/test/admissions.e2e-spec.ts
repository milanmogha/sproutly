import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from './../src/app.module';
import { superAdminCredentials } from './../src/database/seeders/super-admin.credentials';
import { AppValidationPipe } from './../src/common/pipes/validation.pipe';
import { Inquiry } from './../src/modules/admissions/schemas/inquiry.schema';
import { Admission } from './../src/modules/admissions/schemas/admission.schema';
import { Student } from './../src/modules/students/schemas/student.schema';

describe('Admissions (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const models: Record<string, Model<unknown>> = {};
  let inquiryId = '';
  let admissionId = '';
  let enrolledStudentId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new AppValidationPipe());
    await app.init();

    for (const name of [Inquiry.name, Admission.name, Student.name]) {
      models[name] = moduleFixture.get(getModelToken(name));
    }

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(superAdminCredentials());
    token = login.body?.data?.accessToken;
  });

  afterAll(async () => {
    if (admissionId)
      await models[Admission.name].findByIdAndDelete(admissionId).exec();
    if (inquiryId)
      await models[Inquiry.name].findByIdAndDelete(inquiryId).exec();
    if (enrolledStudentId)
      await models[Student.name].findByIdAndDelete(enrolledStudentId).exec();
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('captures an inquiry', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admissions/inquiries')
      .set(auth())
      .send({
        childName: 'Liam Walker',
        childDateOfBirth: '2022-03-10',
        gender: 'male',
        parentName: 'Emma Walker',
        parentPhone: '+1 555-0300',
        gradeInterested: 'Nursery',
        source: 'website',
      })
      .expect(201);
    inquiryId = res.body.data._id;
    expect(res.body.data.status).toBe('new');
  });

  it('updates inquiry status (follow-up)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/admissions/inquiries/${inquiryId}`)
      .set(auth())
      .send({ status: 'contacted', notes: 'Called, will visit Friday' })
      .expect(200);
    expect(res.body.data.status).toBe('contacted');
  });

  it('converts the inquiry into an application', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admissions/inquiries/${inquiryId}/convert`)
      .set(auth())
      .send({ academicYear: '2026-2027' })
      .expect(201);
    admissionId = res.body.data._id;
    expect(res.body.data.applicationNumber).toMatch(/^APP-\d{4}-\d{5}$/);
    expect(res.body.data.firstName).toBe('Liam');
    expect(res.body.data.lastName).toBe('Walker');
    expect(res.body.data.status).toBe('applied');
  });

  it('blocks enrolling before approval', () => {
    return request(app.getHttpServer())
      .post(`/api/admissions/applications/${admissionId}/enroll`)
      .set(auth())
      .expect(400);
  });

  it('records an approval decision', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/admissions/applications/${admissionId}/decision`)
      .set(auth())
      .send({ status: 'approved', reviewNotes: 'Good fit' })
      .expect(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.decisionDate).toBeTruthy();
  });

  it('enrolls the approved application, creating a student', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admissions/applications/${admissionId}/enroll`)
      .set(auth())
      .expect(201);
    expect(res.body.data.admission.status).toBe('enrolled');
    expect(res.body.data.student.admissionNumber).toMatch(/^ADM-\d{4}-\d{5}$/);
    expect(res.body.data.student.fullName).toBe('Liam Walker');
    enrolledStudentId = res.body.data.student._id;
  });

  it('reports admission stats', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admissions/stats')
      .set(auth())
      .expect(200);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data.byStatus).toHaveProperty('enrolled');
  });
});
