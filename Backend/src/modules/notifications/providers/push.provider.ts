import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type Credential,
  type ServiceAccount,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { type Messaging, getMessaging } from 'firebase-admin/messaging';
import * as fs from 'fs';
import * as path from 'path';
import { UsersService } from '../../users/users.service';

export interface PushPayload {
  title: string;
  body: string;
  type?: string;
  data?: Record<string, unknown>;
}

/** How many tokens FCM accepts in one multicast call. */
const FCM_BATCH_LIMIT = 500;

/**
 * Delivers notifications to devices over Firebase Cloud Messaging.
 *
 * Addressed by **user id**, not device token: a user may be signed in on
 * several devices, and resolving that fan-out is this provider's job.
 *
 * Push is optional. With no service account configured the provider disables
 * itself and every send becomes a no-op — the notification is still persisted
 * and still appears in the in-app list, it just isn't delivered to a device.
 * That keeps local development (and a misconfigured deploy) working.
 */
@Injectable()
export class PushProvider implements OnModuleInit {
  private readonly logger = new Logger(PushProvider.name);
  private messaging: Messaging | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit(): void {
    const credential = this.loadCredential();
    if (!credential) {
      this.logger.warn(
        'Push disabled: no Firebase service account found. Set ' +
          'FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH to enable ' +
          'device delivery.',
      );
      return;
    }
    try {
      // getApps() guards against re-initialising across hot reloads and tests,
      // which firebase-admin throws on.
      const [existing] = getApps();
      const app = existing ?? initializeApp({ credential });
      this.messaging = getMessaging(app);
      this.logger.log('Push enabled (Firebase Cloud Messaging).');
    } catch (error) {
      this.logger.error(
        `Push disabled: Firebase failed to initialize — ${(error as Error).message}`,
      );
    }
  }

  /** Reads the service account from the env var, else from the key file. */
  private loadCredential(): Credential | null {
    const inline = this.config.get<string>('firebase.serviceAccountJson');
    if (inline) {
      try {
        return cert(JSON.parse(inline) as ServiceAccount);
      } catch {
        this.logger.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
        return null;
      }
    }

    const configured = this.config.get<string>('firebase.serviceAccountPath');
    if (!configured) {
      return null;
    }
    const file = path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured);
    if (!fs.existsSync(file)) {
      return null;
    }
    try {
      return cert(JSON.parse(fs.readFileSync(file, 'utf8')) as ServiceAccount);
    } catch {
      this.logger.error(`Service account at ${file} is not valid JSON.`);
      return null;
    }
  }

  /**
   * Pushes one notification to every device the given users are signed in on.
   *
   * Never throws — a push is a side effect of the thing that triggered it, and
   * a dead FCM connection must not fail marking attendance. Returns how many
   * devices accepted it.
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
    if (!this.messaging || userIds.length === 0) {
      return 0;
    }
    try {
      const tokens = await this.usersService.findDeviceTokens(userIds);
      if (tokens.length === 0) {
        return 0;
      }

      const message = {
        // The `notification` block is what makes this work with the app closed:
        // Android draws the tray notification itself, without waking Dart. A
        // data-only message would only arrive if the app happened to be alive.
        notification: { title: payload.title, body: payload.body },
        data: this.flatten(payload),
        android: {
          priority: 'high' as const,
          notification: {
            // Must match the channel declared in AndroidManifest.xml, and the
            // one PushService creates on the client.
            channelId: 'sproutly_high_importance',
            sound: 'default',
          },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      };

      let delivered = 0;
      const dead: string[] = [];

      for (let i = 0; i < tokens.length; i += FCM_BATCH_LIMIT) {
        const batch = tokens.slice(i, i + FCM_BATCH_LIMIT);
        const res = await this.messaging.sendEachForMulticast({
          ...message,
          tokens: batch,
        });
        delivered += res.successCount;

        res.responses.forEach((r, index) => {
          if (r.success) return;
          const code = r.error?.code;
          // The app was uninstalled, or the token was replaced. Any other
          // failure (rate limit, transient outage) is worth retrying later, so
          // only these two are treated as permanently dead.
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            dead.push(batch[index]);
          } else {
            this.logger.warn(`Push failed for a device: ${code ?? 'unknown'}`);
          }
        });
      }

      if (dead.length > 0) {
        await this.usersService.pruneDeviceTokens(dead);
        this.logger.log(`Pruned ${dead.length} stale device token(s).`);
      }

      return delivered;
    } catch (error) {
      this.logger.error(
        `Push send failed: ${(error as Error).message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }

  /**
   * FCM only carries string values in `data`, so everything is flattened.
   * `type` (and whatever the triggering module attached — senderId, studentId)
   * is what the app reads to route a tap to the right screen.
   *
   * Title and body are duplicated in here on purpose: a tap handled from a cold
   * start only receives `data`, not the `notification` block.
   */
  private flatten(payload: PushPayload): Record<string, string> {
    const data: Record<string, string> = {
      title: payload.title,
      body: payload.body,
      type: payload.type ?? 'general',
      // Tells the Flutter client this intent came from a tapped notification.
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    };
    for (const [key, value] of Object.entries(payload.data ?? {})) {
      if (value === null || value === undefined) continue;
      data[key] =
        typeof value === 'string' ? value : JSON.stringify(value);
    }
    return data;
  }
}
