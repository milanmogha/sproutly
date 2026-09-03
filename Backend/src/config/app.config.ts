import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  globalPrefix: process.env.API_PREFIX || 'api',
  /**
   * Browser origins allowed to call this API.
   *
   * Defaults to the web client rather than `*`: CORS is sent with
   * `credentials: true`, and a reflected wildcard lets any site on the
   * internet make credentialed cross-origin requests. Set `*` explicitly if
   * you really mean it — the bootstrap logs a warning when you do.
   */
  corsOrigins: (
    process.env.CORS_ORIGINS ||
    process.env.WEB_APP_URL ||
    'http://localhost:3001'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  /**
   * Number of reverse proxies in front of this server.
   *
   * Rate limiting keys on the client IP. Behind a proxy every request appears
   * to come from the proxy, so all callers share one bucket — one attacker
   * would exhaust it for everyone. Set this to the hop count (usually 1) when
   * deploying behind nginx, a load balancer or a tunnel.
   */
  trustProxy: parseInt(process.env.TRUST_PROXY_HOPS || '0', 10),
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '120', 10),
  // Base URL of the Sproutly web client — used to build the invite and
  // password-reset links that emails point at (/set-password, /reset-password).
  webAppUrl: process.env.WEB_APP_URL || 'http://localhost:3001',
  // When set to the admin app's built dist directory, the backend serves it
  // (with SPA fallback) so app and API share one public origin. Empty = off
  // (dev uses the Vite dev server instead).
  webDistPath: process.env.WEB_DIST_PATH || '',
  // Hours an admin invitation (set-password link) stays valid.
  inviteTtlHours: parseInt(process.env.INVITE_TTL_HOURS || '72', 10),
  // Minutes a forgot-password reset link stays valid. Shorter than an invite:
  // a reset is a recovery action on a live account, so the window is tighter.
  resetTtlMinutes: parseInt(process.env.RESET_TTL_MINUTES || '60', 10),
  // Parent phone-OTP login: code length, validity window, and max verify tries.
  otpLength: parseInt(process.env.OTP_LENGTH || '6', 10),
  otpTtlMinutes: parseInt(process.env.OTP_TTL_MINUTES || '5', 10),
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
}));
