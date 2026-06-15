/**
 * @growthx/contracts — API 계약 SSOT.
 * 발행 openapi.json → orval 생성 타입·fetch 클라이언트 + 런타임 설정/봉투 처리.
 * apps 는 이 패키지만 import 한다(손으로 fetch 타입 안 씀). 인증·baseUrl 은 configureApi 로 주입.
 */
export * from './runtime';
export { customFetch } from './mutator';
export * from './generated/model';
export * from './generated/default/default';
