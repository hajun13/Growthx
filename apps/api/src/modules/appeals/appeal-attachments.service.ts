import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Appeal, AppealStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user';
import { canViewUser } from '../../common/access/access.util';

/** 첨부 파일당 최대 크기(10MB) — 컨트롤러 multer 백스톱과 일치. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** 허용 MIME(문서·이미지·압축). EvaluationEvidence 화이트리스트와 동일 정책. */
const ALLOWED_ATTACHMENT_MIME = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/x-hwp',
  'application/haansofthwp',
  'application/vnd.hancom.hwp',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
]);

/** 업로드 파일 최소 타입(@types/multer 글로벌 의존 회피). */
export interface UploadedAppealFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * 이의제기 증빙 첨부 (3B-3, EvaluationEvidence 패턴).
 * 파일 바이트는 DB(Bytes)에 보관. 업로드/삭제=신청자·미종료, 조회=신청자·HR·검토자.
 */
@Injectable()
export class AppealAttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(current: AuthUser, appealId: string, file: UploadedAppealFile | undefined) {
    const appeal = await this.findAppeal(appealId);
    this.assertUploader(current, appeal);
    this.assertEditable(appeal);
    if (!file) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '파일이 필요해요.' });
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: '첨부 파일은 10MB 이하만 업로드할 수 있어요.',
      });
    }
    if (!ALLOWED_ATTACHMENT_MIME.has(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: '지원하지 않는 파일 형식이에요. (문서·이미지·압축 파일만 가능)',
      });
    }
    const filename = (file.originalname?.trim() || 'attachment').slice(0, 255);
    const created = await this.prisma.appealAttachment.create({
      data: {
        appealId,
        filename,
        mimeType: file.mimetype,
        size: file.size,
        data: file.buffer,
        uploadedById: current.id,
      },
    });
    return this.meta(created);
  }

  /** 첨부 메타 목록(바이트 제외). 조회 권한 보유자만. */
  async list(current: AuthUser, appealId: string) {
    const appeal = await this.findAppeal(appealId);
    await this.assertCanView(current, appeal);
    const rows = await this.prisma.appealAttachment.findMany({
      where: { appealId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        appealId: true,
        filename: true,
        mimeType: true,
        size: true,
        uploadedById: true,
        createdAt: true,
      },
    });
    return { data: rows, meta: { page: 1, pageSize: rows.length, total: rows.length } };
  }

  /** 첨부 파일 바이트 조회(다운로드). 조회 권한 보유자만. */
  async getFile(current: AuthUser, appealId: string, attId: string) {
    const appeal = await this.findAppeal(appealId);
    await this.assertCanView(current, appeal);
    const file = await this.prisma.appealAttachment.findUnique({ where: { id: attId } });
    if (!file || file.appealId !== appealId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '첨부 파일을 찾을 수 없어요.' });
    }
    return file;
  }

  /** 첨부 삭제(신청자 본인, 미종료 시에만). */
  async remove(current: AuthUser, appealId: string, attId: string) {
    const appeal = await this.findAppeal(appealId);
    this.assertUploader(current, appeal);
    this.assertEditable(appeal);
    const file = await this.prisma.appealAttachment.findUnique({ where: { id: attId } });
    if (!file || file.appealId !== appealId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '첨부 파일을 찾을 수 없어요.' });
    }
    await this.prisma.appealAttachment.delete({ where: { id: attId } });
    return { id: attId, deleted: true };
  }

  // ── helpers ──
  private async findAppeal(id: string): Promise<Appeal> {
    const appeal = await this.prisma.appeal.findUnique({ where: { id } });
    if (!appeal) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '이의제기를 찾을 수 없어요.' });
    }
    return appeal;
  }

  /** 업로드/삭제 권한: 신청자 본인 또는 HR. */
  private assertUploader(current: AuthUser, appeal: Appeal): void {
    if (current.role === Role.hr_admin || appeal.userId === current.id) return;
    throw new ForbiddenException({ code: 'FORBIDDEN', message: '첨부 권한이 없어요.' });
  }

  /** 종료(closed) 이의제기는 첨부 변경 불가. */
  private assertEditable(appeal: Appeal): void {
    if (appeal.status === AppealStatus.closed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '종료된 이의제기에는 첨부를 변경할 수 없어요.',
      });
    }
  }

  /** 조회 권한: 신청자 본인·HR·피평가자 가시 범위 검토자(팀장/본부장). */
  private async assertCanView(current: AuthUser, appeal: Appeal): Promise<void> {
    if (current.role === Role.hr_admin || appeal.userId === current.id) return;
    if (await canViewUser(this.prisma, current, appeal.userId)) return;
    throw new ForbiddenException({ code: 'FORBIDDEN', message: '조회 권한이 없어요.' });
  }

  private meta(a: {
    id: string;
    appealId: string;
    filename: string;
    mimeType: string;
    size: number;
    uploadedById: string;
    createdAt: Date;
  }) {
    return {
      id: a.id,
      appealId: a.appealId,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      uploadedById: a.uploadedById,
      createdAt: a.createdAt,
    };
  }
}
