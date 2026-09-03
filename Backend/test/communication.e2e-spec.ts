import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from './../src/app.module';
import { superAdminCredentials } from './../src/database/seeders/super-admin.credentials';
import { AppValidationPipe } from './../src/common/pipes/validation.pipe';
import { User } from './../src/modules/users/schemas/user.schema';
import { Student } from './../src/modules/students/schemas/student.schema';
import { Message } from './../src/modules/communication/schemas/message.schema';
import { Circular } from './../src/modules/communication/schemas/circular.schema';
import { PtmRequest } from './../src/modules/communication/schemas/ptm-request.schema';
import { EmergencyAlert } from './../src/modules/communication/schemas/emergency-alert.schema';

describe('Communication (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let teacherToken: string;
  let teacherId = '';
  let studentId = '';
  const models: Record<string, Model<unknown>> = {};
  const teacherEmail = `teacher.comm.${Date.now()}@school.local`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new AppValidationPipe());
    await app.init();

    for (const name of [
      User.name,
      Student.name,
      Message.name,
      Circular.name,
      PtmRequest.name,
      EmergencyAlert.name,
    ]) {
      models[name] = moduleFixture.get(getModelToken(name));
    }

    adminToken = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(superAdminCredentials())
    ).body?.data?.accessToken;

    const teacher = await request(app.getHttpServer())
      .post('/api/users')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({
        name: 'Comm Teacher',
        email: teacherEmail,
        password: 'Teacher123!',
        role: 'teacher',
      });
    teacherId = teacher.body.data._id;

    teacherToken = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: teacherEmail, password: 'Teacher123!' })
    ).body?.data?.accessToken;

    const s = await request(app.getHttpServer())
      .post('/api/students')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({
        firstName: 'Comm',
        lastName: 'Kid',
        dateOfBirth: '2021-01-01',
        gender: 'other',
      });
    studentId = s.body.data._id;
  });

  afterAll(async () => {
    await models[Message.name].deleteMany({ sender: teacherId } as never).exec();
    await models[Message.name].deleteMany({ recipient: teacherId } as never).exec();
    await models[Circular.name].deleteMany({ title: 'E2E Holiday' } as never).exec();
    await models[PtmRequest.name].deleteMany({ student: studentId } as never).exec();
    await models[EmergencyAlert.name].deleteMany({ title: 'E2E Drill' } as never).exec();
    await models[Student.name].findByIdAndDelete(studentId).exec();
    if (teacherId) await models[User.name].findByIdAndDelete(teacherId).exec();
    await app.close();
  });

  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const teacher = () => ({ Authorization: `Bearer ${teacherToken}` });

  it('publishes and lists a circular', async () => {
    await request(app.getHttpServer())
      .post('/api/communication/circulars')
      .set(admin())
      .send({ title: 'E2E Holiday', body: 'School closed Monday', audience: 'all' })
      .expect(201);
    const list = await request(app.getHttpServer())
      .get('/api/communication/circulars?audience=all')
      .set(teacher())
      .expect(200);
    expect(list.body.data.some((c: { title: string }) => c.title === 'E2E Holiday')).toBe(true);
  });

  it('sends a message admin→teacher, visible in the teacher inbox', async () => {
    await request(app.getHttpServer())
      .post('/api/communication/messages')
      .set(admin())
      .send({ recipientId: teacherId, subject: 'Welcome', body: 'Hello teacher' })
      .expect(201);

    const inbox = await request(app.getHttpServer())
      .get('/api/communication/messages/inbox')
      .set(teacher())
      .expect(200);
    expect(inbox.body.data).toHaveLength(1);

    const unread = await request(app.getHttpServer())
      .get('/api/communication/messages/unread-count')
      .set(teacher())
      .expect(200);
    expect(unread.body.data.unread).toBe(1);
  });

  it('marks the message as read', async () => {
    const inbox = await request(app.getHttpServer())
      .get('/api/communication/messages/inbox')
      .set(teacher())
      .expect(200);
    const id = inbox.body.data[0]._id;

    const res = await request(app.getHttpServer())
      .patch(`/api/communication/messages/${id}/read`)
      .set(teacher())
      .expect(200);
    expect(res.body.data.read).toBe(true);

    const unread = await request(app.getHttpServer())
      .get('/api/communication/messages/unread-count')
      .set(teacher())
      .expect(200);
    expect(unread.body.data.unread).toBe(0);
  });

  it('a non-recipient cannot mark the message read', async () => {
    const inbox = await request(app.getHttpServer())
      .get('/api/communication/messages/inbox')
      .set(teacher())
      .expect(200);
    const id = inbox.body.data[0]._id;
    // Admin is the sender, not the recipient → 404
    await request(app.getHttpServer())
      .patch(`/api/communication/messages/${id}/read`)
      .set(admin())
      .expect(404);
  });

  it('creates and responds to a PTM request', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/communication/ptm')
      .set(admin())
      .send({ studentId, teacherId, reason: 'Discuss progress', preferredSlots: ['Mon AM'] })
      .expect(201);
    const id = created.body.data._id;

    const responded = await request(app.getHttpServer())
      .patch(`/api/communication/ptm/${id}/respond`)
      .set(teacher())
      .send({ status: 'scheduled', scheduledAt: '2026-07-01T10:00:00.000Z' })
      .expect(200);
    expect(responded.body.data.status).toBe('scheduled');

    const assigned = await request(app.getHttpServer())
      .get('/api/communication/ptm/assigned')
      .set(teacher())
      .expect(200);
    expect(assigned.body.data).toHaveLength(1);
  });

  it('broadcasts an emergency alert (admin only)', async () => {
    await request(app.getHttpServer())
      .post('/api/communication/alerts')
      .set(admin())
      .send({ title: 'E2E Drill', message: 'Fire drill at noon', severity: 'warning' })
      .expect(201);

    // Teacher cannot broadcast.
    await request(app.getHttpServer())
      .post('/api/communication/alerts')
      .set(teacher())
      .send({ title: 'E2E Drill', message: 'nope' })
      .expect(403);
  });
});
