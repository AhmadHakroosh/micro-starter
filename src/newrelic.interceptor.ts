import {
  Injectable,
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as newrelic from 'newrelic';

@Injectable()
export class NewRelicInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    return newrelic.startWebTransaction(context.getHandler().name, function () {
      const transaction = newrelic.getTransaction();
      return next.handle().pipe(
        tap(() => {
          return transaction.end();
        }),
      );
    });
  }
}
