import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'change-me-in-production',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshSecret:
    process.env.JWT_REFRESH_SECRET || 'change-me-refresh-in-production',
  // A session is meant to last until the user logs out. The refresh token is
  // re-issued on every use, so this ceiling is only reached by a device that
  // goes untouched for a full year.
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '365d',
  // Signed-in devices kept per user; the oldest is evicted beyond this.
  maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '5', 10),
  // After a refresh rotates the token, the token it replaced keeps working for
  // this long. Without it a refresh response lost in flight (or two requests
  // refreshing at once) would strand the device with a dead token.
  refreshGraceSeconds: parseInt(process.env.REFRESH_GRACE_SECONDS || '60', 10),
}));
