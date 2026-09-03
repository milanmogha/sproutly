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
import { FeeStructure } from './../src/modules/fees/schemas/fee-structure.schema';
import { Invoice } from './../src/modules/fees/schemas/invoice.schema';
import { Payment } from './../src/modules/fees/schemas/payment.schema';
import { Receipt } from './../src/modules/fees/schemas/receipt.schema';

describe('Fees (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const models: Record<string, Model<unknown>> = {};
  let classId = '';
  const studentIds: string[] = [];
  let structureId = '';
  let invoiceId = '';

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
      FeeStructure.name,
      Invoice.name,
      Payment.name,
      Receipt.name,
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
      .send({ name: 'Fee Grade', section: 'A', academicYear: '2026-2027' });
    classId = cls.body.data._id;

    for (const n of ['One', 'Two']) {
      const s = await request(app.getHttpServer())
        .post('/api/students')
        .set({ Authorization: `Bearer ${token}` })
        .send({
          firstName: `Fee${n}`,
          lastName: 'Pupil',
          dateOfBirth: '2021-01-01',
          gender: 'other',
        });
      studentIds.push(s.body.data._id);
      await request(app.getHttpServer())
        .post(`/api/classes/${classId}/allocate`)
        .set({ Authorization: `Bearer ${token}` })
        .send({ studentId: s.body.data._id });
    }
  });

  afterAll(async () => {
    await models[Invoice.name]
      .deleteMany({ student: { $in: studentIds } } as never)
      .exec();
    await models[Payment.name]
      .deleteMany({ student: { $in: studentIds } } as never)
      .exec();
    await models[Receipt.name]
      .deleteMany({ student: { $in: studentIds } } as never)
      .exec();
    if (structureId)
      await models[FeeStructure.name].findByIdAndDelete(structureId).exec();
    await models[Student.name]
      .deleteMany({ _id: { $in: studentIds } } as never)
      .exec();
    if (classId) await models[Class.name].findByIdAndDelete(classId).exec();
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('creates a fee structure with computed total', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/fees/structures')
      .set(auth())
      .send({
        name: 'Term 1 Fees',
        academicYear: '2026-2027',
        components: [
          { name: 'Tuition', amount: 8000 },
          { name: 'Activity', amount: 2000 },
        ],
      })
      .expect(201);
    structureId = res.body.data._id;
    expect(res.body.data.totalAmount).toBe(10000);
  });

  it('creates an invoice with an auto number and pending status', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/fees/invoices')
      .set(auth())
      .send({
        studentId: studentIds[0],
        academicYear: '2026-2027',
        period: 'Term 1',
        lineItems: [{ name: 'Tuition', amount: 10000 }],
        dueDate: '2026-07-15',
      })
      .expect(201);
    invoiceId = res.body.data._id;
    expect(res.body.data.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.balance).toBe(10000);
  });

  it('rejects overpayment', () => {
    return request(app.getHttpServer())
      .post('/api/fees/payments')
      .set(auth())
      .send({ invoiceId, amount: 15000, method: 'cash' })
      .expect(400);
  });

  it('records a partial payment and issues a receipt', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/fees/payments')
      .set(auth())
      .send({ invoiceId, amount: 4000, method: 'upi', reference: 'TXN1' })
      .expect(201);
    expect(res.body.data.receipt.receiptNumber).toMatch(/^RCP-\d{4}-\d{5}$/);
    expect(res.body.data.receipt.balanceAfter).toBe(6000);
    expect(res.body.data.invoice.status).toBe('partial');
  });

  it('settles the invoice with the remaining balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/fees/payments')
      .set(auth())
      .send({ invoiceId, amount: 6000, method: 'cash' })
      .expect(201);
    expect(res.body.data.invoice.status).toBe('paid');
  });

  it('rejects paying a settled invoice', () => {
    return request(app.getHttpServer())
      .post('/api/fees/payments')
      .set(auth())
      .send({ invoiceId, amount: 100, method: 'cash' })
      .expect(409);
  });

  it('reports collection totals', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/fees/reports/collection')
      .set(auth())
      .expect(200);
    expect(res.body.data.totalCollected).toBeGreaterThanOrEqual(10000);
    expect(res.body.data.byMethod).toHaveProperty('cash');
  });

  it('bulk-generates invoices for a class and skips duplicates', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/fees/invoices/generate')
      .set(auth())
      .send({
        feeStructureId: structureId,
        classId,
        period: 'Term 2',
        dueDate: '2026-10-15',
      })
      .expect(201);
    expect(first.body.data.created).toBe(2);

    const second = await request(app.getHttpServer())
      .post('/api/fees/invoices/generate')
      .set(auth())
      .send({
        feeStructureId: structureId,
        classId,
        period: 'Term 2',
        dueDate: '2026-10-15',
      })
      .expect(201);
    expect(second.body.data.skipped).toBe(2);
  });

  it('lists pending dues for the class', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/fees/dues?classId=${classId}`)
      .set(auth())
      .expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});
