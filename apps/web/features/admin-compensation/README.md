# admin-compensation feature

보상 현황(`/admin/compensation`) 화면 슬라이스. 평가 결과 기반 차기년도 연봉 시뮬레이션을 그룹/본부/팀 단위로 표시한다(hr_admin 등 열람 권한자만).

## 구조
- `api.ts` — `@growthx/contracts` 생성 클라이언트 호출 + 봉투 unwrap. 팀 시뮬레이션 본문은 `{ data: [...], meta }` 이므로 실제 행은 `res.data.data`.
- `hooks.ts` — `useTeamCompensationSimulationData(cycleId, enabled)`: 팀 전체 시뮬레이션 로드(loading/error/reload).
- `ui/CompensationView.tsx` — 라우트가 렌더하는 화면 컴포넌트. 권한 가드(`isHrAdmin`)·요약 카드·본부 필터·시뮬레이션 표·출력/엑셀 다운로드. 등급 배지 색은 공유 `lib/grade`(dark-on-light) 사용.

## 데이터 소스
- 팀 보상 시뮬레이션: `GET /compensations/simulation/team?cycleId=` → `compensationsControllerSimulationTeam`.
- 직급 라벨: `usePositions`(레지스트리) → `getPositionLabel`.
- 엑셀 내보내기: `downloadExcel('/excel/export/compensation')`.

## 경계
- RBAC/인증/라우트/데이터 의미 불변. 데이터 소스만 생성 클라이언트로 이관(시각/동작 보존).
- 라우트 `app/(main)/admin/compensation/page.tsx` 는 `<CompensationView/>` 만 렌더하는 얇은 래퍼.
