import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../users/dto/user-response.dto';

/**
 * 인증 응답 DTO — OpenAPI 스키마 원천(orval 타입 생성용).
 * 실제 응답은 봉투(@ApiOkEnvelope)로 감싸진다. 값 형태는 AuthService 반환과 1:1 일치.
 * 사용자 형태는 users 모듈의 canonical UserDto(= toUserDto 반환)를 재사용한다.
 */

/** 로그인/비밀번호 변경 성공 — 토큰 + 사용자. */
export class AuthSessionDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}

/** 토큰 재발급(refresh) — 사용자 없이 토큰만. */
export class AuthTokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}

/** 무상태 로그아웃 결과 — 항상 ok=true. */
export class LogoutResultDto {
  @ApiProperty()
  ok!: boolean;
}
