import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** 인증 없이 접근 가능한 엔드포인트 표시 (health, login, refresh). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
