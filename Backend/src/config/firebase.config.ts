import { registerAs } from '@nestjs/config';

/**
 * Firebase Admin credentials for sending push notifications.
 *
 * Two ways to supply the service account, in precedence order:
 *  - FIREBASE_SERVICE_ACCOUNT — the JSON itself, as a single-line string. Suits
 *    hosts (Render/Railway/Heroku) that only offer env vars, no file system.
 *  - FIREBASE_SERVICE_ACCOUNT_PATH — a path to the downloaded JSON key file.
 *
 * With neither set, push is simply off: the app still runs, notifications are
 * still written to the database and still show in the in-app list — they just
 * aren't delivered to devices.
 */
export default registerAs('firebase', () => ({
  serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT || '',
  serviceAccountPath:
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'firebase-service-account.json',
}));
