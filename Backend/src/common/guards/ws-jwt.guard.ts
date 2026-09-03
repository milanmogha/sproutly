import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

/**
 * Validates the JWT bearer token on Socket.IO handshake and attaches the
 * decoded user to `socket.data.user` so the gateway can use it.
 *
 * Clients must pass the token as:
 *   `auth: { token: '<accessToken>' }`   (socket.io-client v4+)
 * or fall back to the query string:
 *   `?token=<accessToken>`               (postman / older clients)
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token = this.extractToken(client);
    if (!token) {
      client.emit('error', { message: 'Unauthorized – no token provided' });
      client.disconnect();
      return false;
    }
    try {
      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
      client.data.user = {
        userId: payload.sub,
        email: payload.email as string,
        role: payload.role as string,
        schoolId: (payload.schoolId as string) ?? null,
      };
      return true;
    } catch {
      client.emit('error', { message: 'Unauthorized – invalid or expired token' });
      client.disconnect();
      return false;
    }
  }

  private extractToken(client: Socket): string | undefined {
    // Preferred: socket.io-client v4 auth handshake
    const authToken: string | undefined = client.handshake?.auth?.token;
    if (authToken) return authToken;

    // Fallback: query string (for Postman / debugging / older clients)
    const queryToken: string | undefined =
      client.handshake?.query?.token as string;
    if (queryToken) return queryToken;

    // Legacy fallback: Authorization header in extraHeaders
    const extra = client.handshake?.headers as Record<string, string> | undefined;
    const header = extra?.authorization ?? extra?.Authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);

    return undefined;
  }
}
