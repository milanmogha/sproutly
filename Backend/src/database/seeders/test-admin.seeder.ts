import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { UsersService } from '../../modules/users/users.service';
import { SchoolsService } from '../../modules/schools/schools.service';
import { UserRole } from '../../common/enums/user-role.enum';

/**
 * Idempotently creates a test school admin so a parent can be onboarded
 * (and phone-OTP login exercised) end to end.
 *
 * Run with: `npm run seed:test-admin`
 *
 * An ADMIN must be scoped to a school — creating students (which provisions
 * the parent phone-OTP account) requires a schoolId. So this reuses the first
 * existing school, or creates a "Test School" when none exists yet.
 */
async function bootstrap() {
  const logger = new Logger('TestAdminSeeder');

  // This seeder exists to make local testing quick, and its defaults are
  // published in this repository. Running it against a production database
  // would plant an admin account whose password anyone can read.
  if (process.env.NODE_ENV === 'production') {
    logger.error(
      'Refusing to run: this seeder creates a test account with known ' +
        'credentials and must never touch a production database.',
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const usersService = app.get(UsersService);
    const schoolsService = app.get(SchoolsService);

    const email = process.env.TEST_ADMIN_EMAIL || 'test-admin@sproutly.local';
    const password = process.env.TEST_ADMIN_PASSWORD || 'admin@1234';
    const name = process.env.TEST_ADMIN_NAME || 'Test Admin';

    // Reuse an existing school, else spin one up so the admin has a scope.
    const existingSchools = await schoolsService.findAll({ page: 1, limit: 1 });
    let schoolId: string;
    let schoolName: string;
    if (existingSchools.total > 0) {
      const school = existingSchools.data[0] as unknown as {
        _id: unknown;
        name: string;
      };
      schoolId = String(school._id);
      schoolName = school.name;
      logger.log(`Reusing existing school: ${schoolName} (${schoolId})`);
    } else {
      const created = (await schoolsService.create({
        name: 'Test School',
        code: 'TEST',
      })) as unknown as { _id: unknown; name: string };
      schoolId = String(created._id);
      schoolName = created.name;
      logger.log(`Created school: ${schoolName} (${schoolId})`);
    }

    const existing = await usersService.findByEmailWithSecret(email);
    if (existing) {
      logger.log(`Admin already exists: ${email} — nothing to do.`);
      return;
    }

    await usersService.create({
      name,
      email,
      password,
      role: UserRole.ADMIN,
      schoolId,
    });
    logger.log(`Admin created: ${email} / ${password} (school: ${schoolName})`);
    logger.warn('Test credentials only — do not ship this account to production.');
  } catch (err) {
    logger.error('Seeding failed', err as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
