import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

const STATUS_TO_CODE: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
};

/**
 * 알려진 Prisma known-request 오류(P2002/P2003/P2025)를 사용자 친화 응답으로 매핑.
 * 매핑 안 되면 null(→ 일반 500, 내부 메시지 미노출). Prisma 클래스 import 대신
 * `.code` 필드(문자 'P####')로 덕타이핑해 결합도를 낮춘다.
 */
function mapPrismaError(
  exception: Error,
): { status: number; code: string; message: string } | null {
  const prismaCode = (exception as { code?: unknown }).code;
  if (typeof prismaCode !== 'string' || !prismaCode.startsWith('P')) return null;
  switch (prismaCode) {
    case 'P2002': // unique 제약 위반
      return { status: 409, code: 'CONFLICT', message: '이미 존재하는 값이에요.' };
    case 'P2003': // 외래키 제약 위반(참조 대상 없음)
      return {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: '참조하는 대상이 존재하지 않아요.',
      };
    case 'P2025': // 대상 레코드 없음
      return { status: 404, code: 'NOT_FOUND', message: '대상을 찾을 수 없어요.' };
    default:
      return null;
  }
}

/**
 * 모든 에러를 { error: { code, message, details } } 봉투로 변환.
 * HttpException 의 response 에 { code } 가 있으면 그것을 우선 사용한다.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = '서버 오류가 발생했어요.';
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_TO_CODE[status] ?? 'ERROR';
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>;
        if (typeof r.code === 'string') code = r.code;
        if (typeof r.message === 'string') message = r.message;
        else if (Array.isArray(r.message)) {
          message = (r.message as string[]).join(', ');
          details = r.message as unknown[];
        }
        if (Array.isArray(r.details)) details = r.details as unknown[];
      }
    } else if (exception instanceof Error) {
      // 알려진 Prisma 오류만 사용자 친화 메시지로 매핑, 그 외 비-HttpException 은
      // 내부 메시지를 노출하지 않는다(스키마·제약명 등 구현 정보 유출 방지).
      const mapped = mapPrismaError(exception);
      if (mapped) {
        status = mapped.status;
        code = mapped.code;
        message = mapped.message;
      }
      // 원본은 서버 로그에만 남긴다(클라이언트엔 마스킹된 메시지).
      this.logger.error(exception.stack ?? exception.message);
    }

    response.status(status).json({ error: { code, message, details } });
  }
}
