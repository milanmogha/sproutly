import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const { method, url } = context
      .switchToHttp()
      .getRequest<{ method: string; url: string }>();
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const { statusCode } = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        this.logger.log(
          `${method} ${url} ${statusCode} - ${Date.now() - now}ms`,
        );
      }),
    );
  }
}
