import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 모든 성공 응답을 봉투로 래핑.
 * - 단건/객체: { data }
 * - 목록(서비스가 { data, meta } 형태로 반환): { data, meta } 그대로 통과
 * 컨트롤러는 raw 객체/배열 또는 { data, meta } 를 반환할 수 있다.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        // 이미 봉투 형태({data} 또는 {data,meta})면 그대로.
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in (payload as Record<string, unknown>)
        ) {
          return payload;
        }
        return { data: payload ?? null };
      }),
    );
  }
}
