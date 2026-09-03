import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import {
  UPLOADS_URL_PREFIX,
  uploadsDir,
} from './common/utils/upload-path.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    // Keeps the untouched request bytes on `req.rawBody`. The Razorpay webhook
    // signs the exact payload it sent, so verifying against re-serialised JSON
    // would fail on key order and whitespace alone.
    rawBody: true,
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const prefix = config.get<string>('app.globalPrefix', 'api');
  const port = config.get<number>('app.port', 3000);
  const corsOrigins = config.get<string[]>('app.corsOrigins', ['*']);
  // Shared with the upload interceptor, so files are always served from the
  // directory they were written to. See uploadsDir() for why this cannot go
  // back to being a join().
  const uploadPath = uploadsDir(config.get<string>('storage.localPath'));

  // Ensure upload directory exists
  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, { recursive: true });
  }

  // Serve uploaded files at /uploads
  app.useStaticAssets(uploadPath, { prefix: UPLOADS_URL_PREFIX });
  logger.log(`🖼️  Serving uploads from ${uploadPath}`);

  // Serve the built admin SPA when WEB_DIST_PATH is configured, so the app
  // and API share one origin (the Tailscale Funnel exposes a single port).
  const webDist = config.get<string>('app.webDistPath', '');
  if (webDist && existsSync(join(webDist, 'index.html'))) {
    app.useStaticAssets(webDist, { index: 'index.html' });
    // SPA fallback: client-routed paths (e.g. /set-password) get index.html.
    // API, uploads, and file-looking paths fall through to Nest's router.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (
        req.method !== 'GET' ||
        req.path.startsWith(`/${prefix}`) ||
        req.path.startsWith('/uploads') ||
        req.path.includes('.')
      ) {
        return next();
      }
      res.sendFile(join(webDist, 'index.html'));
    });
    logger.log(`🌐 Serving admin app from ${webDist}`);
  }

  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(new AppValidationPipe());

  // Rate limiting keys on the client IP. Without this, everything behind a
  // proxy shares the proxy's IP — one bucket for the whole internet.
  const trustProxy = config.get<number>('app.trustProxy', 0);
  if (trustProxy > 0) {
    app.set('trust proxy', trustProxy);
    logger.log(`🔗 Trusting ${trustProxy} proxy hop(s) for client IPs`);
  }

  if (corsOrigins.includes('*')) {
    logger.warn(
      'CORS is set to "*" with credentials enabled — any website can make ' +
        'credentialed requests to this API. Set CORS_ORIGINS for production.',
    );
  }
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  // Enable Socket.IO with the same CORS policy
  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`🚀 Server running on http://localhost:${port}/${prefix}`);
  logger.log(`📁 Uploads served at http://localhost:${port}/uploads`);
  logger.log(`🔌 WebSocket gateway at ws://localhost:${port}/chat`);
}

void bootstrap();
