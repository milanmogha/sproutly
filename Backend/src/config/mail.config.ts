import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  // Outbound SMTP. When enabled=false (or host is empty) emails are logged
  // instead of sent — safe for local development.
  enabled: (process.env.SMTP_ENABLED || 'false') === 'true',
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: (process.env.SMTP_SECURE || 'false') === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.MAIL_FROM || 'Sproutly <no-reply@sproutly.local>',
}));
