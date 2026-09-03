import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AppValidationPipe } from './../src/common/pipes/validation.pipe';

describe('Auth & guards (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror the production bootstrap (main.ts).
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new AppValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a malformed login body with 400 (validation pipe)', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('rejects invalid credentials with 401', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@school.local', password: 'wrongpassword' })
      .expect(401);
  });

  it('blocks a protected route without a token (401)', () => {
    return request(app.getHttpServer()).get('/api/dashboard').expect(401);
  });

  it('returns the success envelope shape on errors', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dashboard')
      .expect(401);
    expect(res.body).toMatchObject({
      success: false,
      statusCode: 401,
      path: '/api/dashboard',
    });
  });
});
