/**
 * The credentials `npm run seed` creates the first super admin with — and the
 * ones the e2e suite logs in as.
 *
 * They live in one place because a default that drifts between the seeder and
 * the tests locks every suite out at login, and the failure reads as "the API
 * is broken" rather than "the password moved".
 *
 * The development fallbacks below are published in this repository, so they
 * are refused outright when NODE_ENV is `production`: a deployment that seeds
 * its super admin with a password anyone can read is the whole platform
 * compromised. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD there.
 */
const DEV_EMAIL = 'admin@school.com';
const DEV_PASSWORD = 'superadmin123';

export function superAdminCredentials(): { email: string; password: string } {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (process.env.NODE_ENV === 'production' && (!email || !password)) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in production — ' +
        'refusing to seed the super admin with the published development default.',
    );
  }

  if (password && password.length < 12) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters.');
  }

  return { email: email || DEV_EMAIL, password: password || DEV_PASSWORD };
}
