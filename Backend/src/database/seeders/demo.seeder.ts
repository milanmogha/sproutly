import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppModule } from '../../app.module';
import { UserRole } from '../../common/enums/user-role.enum';

/**
 * Builds the client-facing demo: one school, seven logins, and enough data in
 * every module that each screen has something real to show.
 *
 * Run with: `node dist/database/seeders/demo.seeder.js`
 *
 * Unlike {@link ../seeders/test-admin.seeder} this is *meant* to run against
 * the deployed database — it is how the demo gets there. Two properties make
 * that safe to repeat:
 *
 *  * **Self-contained.** Everything lives in one school (code `DEMO`). Nothing
 *    outside it is read or written.
 *  * **Idempotent by reset.** It deletes the demo school and its accounts
 *    first, then rebuilds. Re-running gives a clean demo rather than doubling
 *    every list, which is what you want after a client has clicked around.
 *
 * The parent logins use a fixed OTP instead of a real inbox. That is wired in
 * `AuthService.demoOtpFor` and only works for addresses named in
 * `DEMO_PARENT_EMAILS`, with `DEMO_OTP` set.
 */

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@12345';
const SCHOOL_CODE = 'DEMO';

const ACCOUNTS = {
  superAdmin: { email: 'superadmin@demo.com', name: 'Priya Menon' },
  admins: [
    { email: 'admin@demo.com', name: 'Anita Desai' },
    { email: 'admin2@demo.com', name: 'Rahul Verma' },
  ],
  teachers: [
    { email: 'teacher@demo.com', name: 'Sneha Kulkarni' },
    { email: 'teacher2@demo.com', name: 'Arjun Nair' },
  ],
  parents: [
    { email: 'parent@demo.com', name: 'Meera Sharma', phone: '9800000001' },
    { email: 'parent2@demo.com', name: 'Vikram Patel', phone: '9800000002' },
  ],
};

/** `n` days ago as a Date at midnight, and as `YYYY-MM-DD`. */
const dayAgo = (n: number): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};
const pick = <T>(list: T[], i: number): T => list[i % list.length];

/** A seed document. Deliberately loose — the shapes are the schemas', not ours. */
type Row = Record<string, unknown>;

async function bootstrap() {
  const logger = new Logger('DemoSeeder');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const conn = app.get<Connection>(getConnectionToken());
    const db = conn.db;
    if (!db) throw new Error('no database connection');

    const col = (name: string) => db.collection(name);
    const year = new Date().getFullYear();
    const academicYear = `${year}-${year + 1}`;

    /* ── Reset ───────────────────────────────────────────────────────── */

    const previous = await col('schools').findOne({ code: SCHOOL_CODE });
    if (previous) {
      const sid = previous._id;
      let wiped = 0;
      for (const c of await db.collections()) {
        if (c.collectionName === 'schools') continue;
        const { deletedCount } = await c.deleteMany({ schoolId: sid });
        wiped += deletedCount ?? 0;
      }
      await col('schools').deleteOne({ _id: sid });
      logger.warn(`Reset previous demo school (${wiped} rows removed)`);
    }
    // The super admin sits outside any school, so it is keyed by email.
    await col('users').deleteMany({ email: ACCOUNTS.superAdmin.email });

    /* ── Accounts and school ─────────────────────────────────────────── */

    // bcrypt via the same service the app uses, so the hash format matches.
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const now = new Date();
    const base = { createdAt: now, updatedAt: now };

    const owner = (
      await col('owners').insertOne({
        name: 'Little Sprouts Education Trust',
        contactPerson: 'Priya Menon',
        email: 'trust@demo.com',
        phone: '9800000000',
        isActive: true,
        ...base,
      })
    ).insertedId;

    const schoolId = (
      await col('schools').insertOne({
        name: 'Sproutly Demo Preschool',
        code: SCHOOL_CODE,
        ownerId: owner,
        status: 'active',
        isActive: true,
        contactEmail: 'hello@demo.com',
        contactPhone: '9800000010',
        address: {
          line1: '14 Garden Lane',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411001',
          country: 'India',
        },
        currentAcademicYear: academicYear,
        trustName: 'Little Sprouts Education Trust',
        affiliationNumber: 'AFF-DEMO-2026',
        enabledModules: [],
        ...base,
      })
    ).insertedId;

    const mkUser = async (
      email: string,
      name: string,
      role: UserRole,
      extra: Record<string, unknown> = {},
    ) =>
      (
        await col('users').insertOne({
          name,
          email: email.toLowerCase(),
          password: hash,
          role,
          isActive: true,
          ...(role === UserRole.SUPER_ADMIN ? {} : { schoolId }),
          ...base,
          ...extra,
        })
      ).insertedId;

    await mkUser(ACCOUNTS.superAdmin.email, ACCOUNTS.superAdmin.name, UserRole.SUPER_ADMIN);
    const adminIds: unknown[] = [];
    for (const a of ACCOUNTS.admins) {
      adminIds.push(await mkUser(a.email, a.name, UserRole.ADMIN));
    }
    const teacherIds: unknown[] = [];
    for (const t of ACCOUNTS.teachers) {
      teacherIds.push(await mkUser(t.email, t.name, UserRole.TEACHER));
    }
    // Parents log in with the fixed OTP, so they carry no usable password.
    const parentIds: unknown[] = [];
    for (const p of ACCOUNTS.parents) {
      parentIds.push(
        await mkUser(p.email, p.name, UserRole.PARENT, { password: null, phone: p.phone }),
      );
    }

    /* ── Classes ─────────────────────────────────────────────────────── */

    const classes: unknown[] = [];
    for (const [i, def] of [
      { name: 'Nursery', section: 'A', room: '101', capacity: 20 },
      { name: 'LKG', section: 'A', room: '102', capacity: 24 },
    ].entries()) {
      classes.push(
        (
          await col('classes').insertOne({
            ...def,
            academicYear,
            schoolId,
            classTeacher: teacherIds[i],
            isActive: true,
            ...base,
          })
        ).insertedId,
      );
    }

    /* ── Students ────────────────────────────────────────────────────── */

    // A parent account belongs to exactly one child. Siblings get their own
    // account rather than sharing one, so nothing has to reason about which
    // child a parent is currently "looking at".
    const kids = [
      { first: 'Aarav', last: 'Sharma', gender: 'male', cls: 0, parent: 0 },
      { first: 'Kabir', last: 'Patel', gender: 'male', cls: 0, parent: 1 },
      { first: 'Diya', last: 'Sharma', gender: 'female', cls: 1, parent: null },
      { first: 'Anaya', last: 'Iyer', gender: 'female', cls: 0, parent: null },
      { first: 'Vivaan', last: 'Rao', gender: 'male', cls: 1, parent: null },
      { first: 'Myra', last: 'Joshi', gender: 'female', cls: 1, parent: null },
      { first: 'Reyansh', last: 'Gupta', gender: 'male', cls: 0, parent: null },
      { first: 'Saanvi', last: 'Nair', gender: 'female', cls: 1, parent: null },
    ];

    const studentIds: unknown[] = [];
    for (const [i, k] of kids.entries()) {
      const guardianName =
        k.parent !== null ? ACCOUNTS.parents[k.parent].name : `${k.first}'s mother`;
      const guardianPhone =
        k.parent !== null ? ACCOUNTS.parents[k.parent].phone : `98000001${10 + i}`;
      studentIds.push(
        (
          await col('students').insertOne({
            firstName: k.first,
            lastName: k.last,
            admissionNumber: `DEMO-${String(101 + i)}`,
            gender: k.gender,
            status: 'active',
            dateOfBirth: new Date(`${year - 4}-0${(i % 9) + 1}-1${i % 9}`),
            classId: classes[k.cls],
            schoolId,
            ...(k.parent !== null ? { parentUserId: parentIds[k.parent] } : {}),
            guardians: [
              {
                name: guardianName,
                relationship: k.parent === 1 ? 'father' : 'mother',
                phone: guardianPhone,
                ...(k.parent !== null ? { email: ACCOUNTS.parents[k.parent].email } : {}),
                isPrimary: true,
              },
            ],
            emergencyContacts: [
              { name: 'Sunita Sharma', relationship: 'Grandmother', phone: '9800000099' },
            ],
            address: {
              line1: `${12 + i} Rose Villa`,
              city: 'Pune',
              state: 'Maharashtra',
              postalCode: '411001',
            },
            medicalInfo: {
              bloodGroup: pick(['A+', 'B+', 'O+', 'AB+'], i),
              allergies: i % 3 === 0 ? ['Peanuts'] : [],
              conditions: i % 4 === 0 ? ['Mild asthma'] : [],
              medications: [],
              physicianName: 'Dr. Kavita Rao',
              physicianPhone: '9800000098',
              vaccinations: [
                { name: 'MMR', administered: true, administeredOn: dayAgo(400) },
                { name: 'DTP booster', administered: false, dueOn: dayAgo(-60) },
              ],
            },
            profileCompleted: true,
            ...base,
          })
        ).insertedId,
      );
    }

    logger.warn(`School, ${kids.length} students and 7 logins created`);

    /* ── Attendance: two working weeks ───────────────────────────────── */

    const attendance: Row[] = [];
    for (let d = 1; d <= 14; d++) {
      const date = dayAgo(d);
      if (date.getDay() === 0) continue; // Sundays are not marked
      for (const [i, sid] of studentIds.entries()) {
        const roll = (d + i) % 11;
        attendance.push({
          student: sid,
          classId: classes[kids[i].cls],
          date,
          status: roll === 0 ? 'absent' : roll === 1 ? 'late' : 'present',
          markedBy: teacherIds[kids[i].cls],
          schoolId,
          ...base,
        });
      }
    }
    await col('studentattendances').insertMany(attendance);

    const staffAtt: Row[] = [];
    for (let d = 1; d <= 7; d++) {
      const date = dayAgo(d);
      if (date.getDay() === 0) continue;
      for (const [i, tid] of teacherIds.entries()) {
        staffAtt.push({
          staff: tid,
          date,
          status: (d + i) % 6 === 0 ? 'absent' : 'present',
          schoolId,
          ...base,
        });
      }
    }
    await col('staffattendances').insertMany(staffAtt);

    /* ── Academics ───────────────────────────────────────────────────── */

    await col('homeworks').insertMany(
      [
        { title: 'Trace the letter A', subject: 'English', days: 1 },
        { title: 'Count objects 1–10', subject: 'Numbers', days: 2 },
        { title: 'Colour the rainbow', subject: 'Art', days: 3 },
        { title: 'Practise the rhyme "Twinkle Twinkle"', subject: 'Rhymes', days: 5 },
      ].map((h, i) => ({
        title: h.title,
        subject: h.subject,
        description: `${h.title}. Please help your child finish this at home.`,
        classId: pick(classes, i),
        createdBy: pick(teacherIds, i),
        assignedDate: dayAgo(i),
        dueDate: dayAgo(-(i + 1)),
        schoolId,
        ...base,
      })),
    );

    const assessmentIds: unknown[] = [];
    for (const [i, a] of [
      { title: 'Term 1 — Language', subject: 'English', maxScore: 25 },
      { title: 'Term 1 — Numbers', subject: 'Numbers', maxScore: 25 },
    ].entries()) {
      assessmentIds.push(
        (
          await col('assessments').insertOne({
            ...a,
            type: 'term',
            date: dayAgo(10 + i),
            classId: pick(classes, i),
            schoolId,
            ...base,
          })
        ).insertedId,
      );
    }
    await col('results').insertMany(
      studentIds.flatMap((sid, i) =>
        assessmentIds.map((aid, j) => ({
          assessment: aid,
          student: sid,
          score: 14 + ((i * 3 + j * 5) % 11),
          grade: pick(['A', 'B', 'A+', 'B+'], i + j),
          remarks: 'Steady progress this term.',
          recordedBy: pick(teacherIds, i),
          schoolId,
          ...base,
        })),
      ),
    );

    await col('milestones').insertMany(
      studentIds.slice(0, 5).flatMap((sid, i) =>
        [
          { title: 'Holds a crayon correctly', category: 'motor', status: 'achieved' },
          { title: 'Recognises own name in print', category: 'language', status: 'emerging' },
          { title: 'Shares toys with peers', category: 'social', status: 'achieved' },
        ].map((m, j) => ({
          ...m,
          student: sid,
          notes: 'Observed during classroom activity.',
          recordedBy: pick(teacherIds, i + j),
          schoolId,
          ...base,
        })),
      ),
    );

    await col('teacherremarks').insertMany(
      studentIds.slice(0, 6).map((sid, i) => ({
        student: sid,
        category: pick(['behavior', 'academic', 'appreciation'], i),
        date: dayAgo(i + 2),
        remark: pick(
          [
            'Settled in beautifully this week and is speaking up more in circle time.',
            'Great focus during number work — counted to twenty unaided.',
            'A kind friend; helped a classmate tidy up without being asked.',
          ],
          i,
        ),
        recordedBy: pick(teacherIds, i),
        schoolId,
        ...base,
      })),
    );

    await col('lessonplans').insertMany(
      [
        { title: 'Week 1 — All about me', objectives: ['Name recognition', 'Self portraits'] },
        { title: 'Week 2 — Animals around us', objectives: ['Animal sounds', 'Habitats'] },
      ].map((p, i) => ({
        ...p,
        classId: pick(classes, i),
        week: i + 1,
        academicYear,
        createdBy: pick(teacherIds, i),
        schoolId,
        ...base,
      })),
    );

    await col('syllabuses').insertMany(
      classes.map((cid, i) => ({
        classId: cid,
        subject: pick(['English', 'Numbers'], i),
        academicYear,
        units: [
          { title: 'Unit 1 — Letters A–M', description: 'Recognition and tracing' },
          { title: 'Unit 2 — Letters N–Z', description: 'Sounds and simple words' },
        ],
        schoolId,
        ...base,
      })),
    );

    /* ── Daycare: a full week of daily logs ──────────────────────────── */

    const meals: Row[] = [];
    const naps: Row[] = [];
    const acts: Row[] = [];
    const health: Row[] = [];
    const obs: Row[] = [];
    for (let d = 1; d <= 5; d++) {
      const date = dayAgo(d);
      for (const [i, sid] of studentIds.slice(0, 4).entries()) {
        meals.push(
          {
            studentId: sid, date, mealType: 'breakfast', menu: 'Idli with sambar',
            amountEaten: pick(['all', 'most', 'some'], i + d), notes: '', schoolId, ...base,
          },
          {
            studentId: sid, date, mealType: 'lunch', menu: 'Rice, dal and beans',
            amountEaten: pick(['most', 'all', 'some'], i), notes: '', schoolId, ...base,
          },
          {
            studentId: sid, date, mealType: 'afternoon_snack', menu: 'Fruit bowl',
            amountEaten: pick(['all', 'most'], d), notes: '', schoolId, ...base,
          },
        );
        naps.push({
          studentId: sid, date, startTime: '13:00', endTime: '14:30',
          quality: pick(['sound', 'restless', 'sound'], i + d),
          notes: 'Settled quickly.', schoolId, ...base,
        });
        acts.push({
          studentId: sid, date,
          title: pick(['Finger painting', 'Music and movement', 'Story circle', 'Sand play'], i + d),
          category: pick(['art', 'music', 'story', 'play', 'outdoor'], i + d),
          description: 'Took part happily and stayed engaged throughout.',
          photos: [], notes: '', schoolId, ...base,
        });
        obs.push({
          studentId: sid, date,
          mood: pick(['happy', 'calm', 'energetic', 'tired'], i + d),
          observation: 'Cheerful through the morning and joined group play readily.',
          context: 'Free play', notes: '', schoolId, ...base,
        });
      }
      if (d % 2 === 0) {
        health.push({
          studentId: studentIds[d % 4], date, type: 'temperature',
          description: 'Routine afternoon check.', temperature: 36.8,
          severity: 'info', notes: '', schoolId, ...base,
        });
      }
    }
    await col('mealupdates').insertMany(meals);
    await col('napupdates').insertMany(naps);
    await col('activitylogs').insertMany(acts);
    await col('healthupdates').insertMany(health);
    await col('behavioralobservations').insertMany(obs);

    /* ── Fees ────────────────────────────────────────────────────────── */

    const structureId = (
      await col('feestructures').insertOne({
        name: `Tuition ${academicYear}`,
        academicYear,
        frequency: 'monthly',
        components: [
          { name: 'Tuition', amount: 4500 },
          { name: 'Activity fee', amount: 800 },
          { name: 'Snacks', amount: 700 },
        ],
        totalAmount: 6000,
        schoolId,
        isActive: true,
        ...base,
      })
    ).insertedId;

    for (const [i, sid] of studentIds.entries()) {
      for (let m = 0; m < 3; m++) {
        const paid = m > 0 || i % 3 !== 0;
        const invoiceId = (
          await col('invoices').insertOne({
            invoiceNumber: `INV-DEMO-${100 + i * 3 + m}`,
            student: sid,
            classId: classes[kids[i].cls],
            feeStructure: structureId,
            period: `${year}-${String(((new Date().getMonth() - m + 12) % 12) + 1).padStart(2, '0')}`,
            issuedAt: dayAgo(m * 30 + 5),
            lineItems: [
              { name: 'Tuition', amount: 4500 },
              { name: 'Activity fee', amount: 800 },
              { name: 'Snacks', amount: 700 },
            ],
            totalAmount: 6000,
            amountPaid: paid ? 6000 : 0,
            dueDate: dayAgo(m * 30 - 5),
            status: paid ? 'paid' : 'pending',
            academicYear,
            schoolId,
            ...base,
          })
        ).insertedId;
        if (paid) {
          const receiptNo = `RCPT-DEMO-${100 + i * 3 + m}`;
          const paymentId = (
            await col('payments').insertOne({
              invoice: invoiceId, student: sid, amount: 6000,
              method: pick(['upi', 'cash', 'card', 'online'], i + m),
              paymentNumber: `PAY-DEMO-${100 + i * 3 + m}`,
              receivedBy: pick(adminIds, i), paidAt: dayAgo(m * 30), schoolId, ...base,
            })
          ).insertedId;
          await col('receipts').insertOne({
            receiptNumber: receiptNo, payment: paymentId, invoice: invoiceId,
            student: sid, amount: 6000, balanceAfter: 0,
            issuedAt: dayAgo(m * 30), schoolId, ...base,
          });
        }
      }
    }

    /* ── Communication ───────────────────────────────────────────────── */

    await col('circulars').insertMany(
      [
        { title: 'Annual Day — 20th of next month', audience: 'all' },
        { title: 'Parent–teacher meetings open for booking', audience: 'parents' },
        { title: 'Staff training day — school closed', audience: 'staff' },
      ].map((c, i) => ({
        ...c,
        body:
          `${c.title}. Please see the notice board for details, or speak to the ` +
          `office if you have any questions.`,
        publishedAt: dayAgo(i + 1),
        createdBy: pick(adminIds, i),
        schoolId,
        ...base,
      })),
    );

    await col('messages').insertMany([
      {
        sender: adminIds[0], recipient: teacherIds[0],
        body: 'Could you share the Nursery A attendance summary before Friday?',
        read: true, schoolId, ...base,
      },
      {
        sender: teacherIds[0], recipient: adminIds[0],
        body: 'Sent it across this morning — everything is up to date.',
        read: true, schoolId, ...base,
      },
      {
        sender: parentIds[0], recipient: adminIds[0],
        body: 'Aarav will be away next Monday for a family function.',
        read: false, schoolId, ...base,
      },
      {
        sender: teacherIds[0], recipient: parentIds[0],
        body: 'Aarav did beautifully in today’s story circle — he retold the whole tale!',
        read: false, relatedStudent: studentIds[0], schoolId, ...base,
      },
    ]);

    await col('ptmrequests').insertMany([
      {
        student: studentIds[0], requestedBy: parentIds[0],
        parent: parentIds[0], teacher: teacherIds[0],
        reason: 'Would like to discuss Aarav’s reading progress.',
        preferredSlots: 'Weekday mornings',
        status: 'scheduled', scheduledAt: dayAgo(-3), schoolId, ...base,
      },
      {
        student: studentIds[2], requestedBy: parentIds[1],
        parent: parentIds[1], teacher: teacherIds[0],
        reason: 'General catch-up on how Kabir is settling in.',
        preferredSlots: 'Any afternoon',
        status: 'requested', schoolId, ...base,
      },
    ]);

    await col('events').insertMany(
      [
        { title: 'Annual Day', venue: 'School auditorium', days: -14 },
        { title: 'Sports Day', venue: 'Playground', days: -25 },
        { title: 'Storytelling Week', venue: 'Library corner', days: -7 },
      ].map((e) => ({
        title: e.title,
        description: `Join us for ${e.title}. Parents are warmly invited.`,
        venue: e.venue,
        startDate: dayAgo(e.days),
        schoolId,
        ...base,
      })),
    );

    await col('holidays').insertMany(
      [
        { title: 'Diwali break', days: -20 },
        { title: 'Founder’s Day', days: -40 },
        { title: 'Republic Day', days: 30 },
      ].map((h) => ({
        title: h.title, date: dayAgo(h.days), description: 'School closed.',
        schoolId, ...base,
      })),
    );

    await col('leaverequests').insertMany([
      {
        studentId: studentIds[1], applicantId: parentIds[0], applicantRole: 'parent',
        type: 'casual', fromDate: dayAgo(-2), toDate: dayAgo(-1),
        reason: 'Family wedding out of town.', status: 'pending',
        isActive: true, schoolId, ...base,
      },
      {
        studentId: studentIds[2], applicantId: parentIds[1], applicantRole: 'parent',
        type: 'sick', fromDate: dayAgo(6), toDate: dayAgo(5),
        reason: 'Down with a cold.', status: 'approved',
        reviewedBy: adminIds[0], reviewNote: 'Get well soon!',
        isActive: true, schoolId, ...base,
      },
    ]);

    /* ── Admissions, transport, staff ────────────────────────────────── */

    await col('inquiries').insertMany(
      [
        { childName: 'Ishaan Kapoor', parentName: 'Rohit Kapoor', status: 'new' },
        { childName: 'Tara Menon', parentName: 'Lakshmi Menon', status: 'contacted' },
        { childName: 'Aryan Bose', parentName: 'Sujata Bose', status: 'visited' },
      ].map((q, i) => ({
        ...q,
        parentPhone: `98000002${10 + i}`,
        parentEmail: `enquiry${i + 1}@demo.com`,
        childDateOfBirth: new Date(`${year - 3}-0${i + 2}-15`),
        gender: pick(['male', 'female'], i),
        notes: 'Walk-in enquiry.',
        schoolId,
        ...base,
      })),
    );

    await col('vehicles').insertOne({
      title: 'Route 1 — Bus MH-12-AB-1234',
      routeName: 'Kothrud loop',
      vehicleNumber: 'MH-12-AB-1234',
      driverName: 'Suresh Pawar',
      driverPhone: '9800000097',
      notes: 'Leaves the school gate at 7:30 am sharp.',
      metadata: {
        stops: [
          { name: 'Karve Road corner', time: '7:45 am' },
          { name: 'Mayur Colony', time: '7:55 am' },
        ],
      },
      assignedStudents: [studentIds[0], studentIds[2]],
      assignedStaff: [teacherIds[0]],
      isActive: true,
      schoolId,
      ...base,
    });

    await col('staffs').insertMany(
      [
        { title: 'Lata Bhosale', role: 'Helper' },
        { title: 'Ganesh More', role: 'Caretaker' },
      ].map((s, i) => ({
        title: s.title,
        notes: `${s.role} — full time.`,
        metadata: { role: s.role, phone: `98000003${10 + i}`, department: 'Support' },
        isActive: true,
        schoolId,
        ...base,
      })),
    );

    await col('notifications').insertMany(
      parentIds.flatMap((pid) => [
        {
          recipient: pid, title: 'Fees received',
          body: 'Thank you — this month’s fees have been received.',
          type: 'fees', read: false, sentAt: dayAgo(1), schoolId, ...base,
        },
        {
          recipient: pid, title: 'New circular',
          body: 'Annual Day — 20th of next month.',
          type: 'circular', read: true, sentAt: dayAgo(2), schoolId, ...base,
        },
      ]),
    );

    /* ── Summary ─────────────────────────────────────────────────────── */

    const counts: string[] = [];
    for (const c of await db.collections()) {
      const n = await c.countDocuments({ schoolId });
      if (n) counts.push(`${c.collectionName}=${n}`);
    }

    logger.warn('── Demo ready ──────────────────────────────');
    logger.warn(`School  : Sproutly Demo Preschool (${SCHOOL_CODE})`);
    logger.warn(`Password: ${DEMO_PASSWORD}  (super admin, admins, teachers)`);
    logger.warn(`Parents : ${ACCOUNTS.parents.map((p) => p.email).join(', ')} — OTP only`);
    logger.warn(`Data    : ${counts.sort().join(', ')}`);
  } catch (err) {
    logger.error('Demo seeding failed', err as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
