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
import { MealUpdate } from './../src/modules/daycare/schemas/meal-update.schema';
import { NapUpdate } from './../src/modules/daycare/schemas/nap-update.schema';
import { ActivityLog } from './../src/modules/daycare/schemas/activity-log.schema';
import { HealthUpdate } from './../src/modules/daycare/schemas/health-update.schema';
import { BehavioralObservation } from './../src/modules/daycare/schemas/behavioral-observation.schema';

describe('Daycare (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const models: Record<string, Model<unknown>> = {};
  let studentId = '';
  const DATE = '2026-06-02';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new AppValidationPipe());
    await app.init();

    for (const name of [
      Student.name,
      MealUpdate.name,
      NapUpdate.name,
      ActivityLog.name,
      HealthUpdate.name,
      BehavioralObservation.name,
    ]) {
      models[name] = moduleFixture.get(getModelToken(name));
    }

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(superAdminCredentials());
    token = login.body?.data?.accessToken;

    const s = await request(app.getHttpServer())
      .post('/api/students')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        firstName: 'Day',
        lastName: 'Care',
        dateOfBirth: '2022-01-01',
        gender: 'female',
      });
    studentId = s.body.data._id;
  });

  afterAll(async () => {
    for (const name of [
      MealUpdate.name,
      NapUpdate.name,
      ActivityLog.name,
      HealthUpdate.name,
      BehavioralObservation.name,
    ]) {
      await models[name].deleteMany({ student: studentId } as never).exec();
    }
    await models[Student.name].findByIdAndDelete(studentId).exec();
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('rejects an invalid meal payload (bad enum)', () => {
    return request(app.getHttpServer())
      .post('/api/daycare/meals')
      .set(auth())
      .send({ studentId, mealType: 'brunch', menu: 'x' })
      .expect(400);
  });

  it('logs a meal, nap, activity, health and observation', async () => {
    await request(app.getHttpServer())
      .post('/api/daycare/meals')
      .set(auth())
      .send({
        studentId,
        date: DATE,
        mealType: 'lunch',
        menu: 'Rice & veggies',
        amountEaten: 'most',
      })
      .expect(201);

    const nap = await request(app.getHttpServer())
      .post('/api/daycare/naps')
      .set(auth())
      .send({
        studentId,
        date: DATE,
        startTime: '2026-06-02T13:00:00.000Z',
        endTime: '2026-06-02T14:30:00.000Z',
        quality: 'sound',
      })
      .expect(201);
    expect(nap.body.data.durationMinutes).toBe(90);

    await request(app.getHttpServer())
      .post('/api/daycare/activities')
      .set(auth())
      .send({
        studentId,
        date: DATE,
        title: 'Finger painting',
        category: 'art',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/daycare/health')
      .set(auth())
      .send({
        studentId,
        date: DATE,
        type: 'temperature',
        description: 'Slight fever',
        temperature: 37.8,
        severity: 'attention',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/daycare/observations')
      .set(auth())
      .send({
        studentId,
        date: DATE,
        mood: 'happy',
        observation: 'Played well with peers',
      })
      .expect(201);
  });

  it('compiles the digital diary for the day', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/daycare/diary/${studentId}?date=${DATE}`)
      .set(auth())
      .expect(200);
    const d = res.body.data;
    expect(d.meals).toHaveLength(1);
    expect(d.naps).toHaveLength(1);
    expect(d.activities).toHaveLength(1);
    expect(d.health).toHaveLength(1);
    expect(d.observations).toHaveLength(1);
  });

  it('lists meals for the student', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/daycare/meals?studentId=${studentId}&date=${DATE}`)
      .set(auth())
      .expect(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('deletes an entry via the typed endpoint', async () => {
    const meals = await request(app.getHttpServer())
      .get(`/api/daycare/meals?studentId=${studentId}`)
      .set(auth())
      .expect(200);
    const mealId = meals.body.data[0]._id;

    await request(app.getHttpServer())
      .delete(`/api/daycare/meals/${mealId}`)
      .set(auth())
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/daycare/meals?studentId=${studentId}`)
      .set(auth())
      .expect(200);
    expect(after.body.data).toHaveLength(0);
  });
});
