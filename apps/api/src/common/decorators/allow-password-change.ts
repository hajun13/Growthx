import { SetMetadata } from '@nestjs/common';

export const ALLOW_PW_CHANGE_KEY = 'allowDuringPasswordChange';
/**
 * M3 Item1: mustChangePassword=true 사용자도 접근 허용되는 엔드포인트 표시.
 * (auth: change-password·logout·me 등.) 미표시 + mustChangePassword=true → 403 FORCE_PASSWORD_CHANGE.
 */
export const AllowDuringPasswordChange = () =>
  SetMetadata(ALLOW_PW_CHANGE_KEY, true);
