import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { UsersService } from '../../modules/users/users.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { superAdminCredentials } from './super-admin.credentials';

/**
 * Idempotently creates the initial super-admin account.
 * Run with: `npm run seed`
 */
async function bootstrap() {
  const logger = new Logger('SuperAdminSeeder');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const usersService = app.get(UsersService);
    const { email, password } = superAdminCredentials();

    const existing = await usersService.findByEmailWithSecret(email);
    if (existing) {
      logger.log(`Super admin already exists: ${email}`);
      return;
    }

    await usersService.create({
      name: 'Super Admin',
      email,
      password,
      role: UserRole.SUPER_ADMIN,
    });
    logger.log(`Super admin created: ${email}`);
    logger.warn('Remember to change the default password after first login.');
  } catch (err) {
    logger.error('Seeding failed', err as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void bootstrap();
