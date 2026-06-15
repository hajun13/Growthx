/**
 * @growthx/contracts — API 계약 SSOT.
 * 발행 openapi.json → orval 생성 타입·fetch 클라이언트 + 런타임 설정/봉투 처리.
 * apps 는 이 패키지만 import 한다(손으로 fetch 타입 안 씀). 인증·baseUrl 은 configureApi 로 주입.
 *
 * ⚠ orval tags-split 은 태그별 디렉토리로 분리하고 루트 배럴을 만들지 않는다.
 * 컨트롤러에 새 @ApiTags 를 추가하면 아래에 `export * from './generated/<tag>/<tag>';` 한 줄을 더한다.
 */
export * from './runtime';
export { customFetch } from './mutator';
export * from './generated/model';
export * from './generated/default/default';
export * from './generated/notifications/notifications';
export * from './generated/results/results';
