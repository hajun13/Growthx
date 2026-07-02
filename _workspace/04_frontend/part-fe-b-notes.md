# FE-B — 사용자 관리 정렬 + 조직 구조 개선 + 권한 관리 조직 필터 (2026-07-02)

Part/ 클라이언트 수정요청 §P3·P4·P5. 표현 계층만 수정, 훅/API 시그니처 불변.

## 변경 파일

### P3. 사용자 관리 (`app/(main)/admin/users` → `features/admin-users`)
- `apps/web/features/admin-users/ui/UsersTab.tsx`
  - 클릭 정렬 가능한 컬럼 헤더(`SortHeader`) 추가: **그룹/본부·팀·직급·입사일·상태**. 클릭 시 오름↔내림 토글, `ArrowUp`/`ArrowDown`/`ArrowUpDown`(비활성) 아이콘으로 방향 표시.
  - 그룹 필터(기존) 아래 **팀·직급 빠른 필터** 행 추가(`FilterChipBar` 재사용, 검색과 병행 동작). 목록에 실존하는 값만 칩으로 노출(빈 칩 방지).
  - 이름 앞 이니셜 원(검은/파랑 배경) → Foundation `Avatar` 컴포넌트로 교체(`size="sm"`, 비활성 사용자는 `opacity-50`).
- `apps/web/features/admin-users/ui/AdminUsersView.tsx`
  - `filterTeam`/`filterPosition`/`sortKey`/`sortDir` state 추가. `teamFilterOptions`/`positionFilterOptions`는 현재 `rows` 기준 파생(useMemo).
  - `filtered` — 그룹·팀·직급 필터를 모두 AND 조건으로 병행 적용 후, `sortKey` 있으면 해당 키 기준 정렬(직급은 `PositionDef.sortOrder` 기준), 없으면 기존처럼 이름순. 전부 클라이언트 사이드, API 호출 없음.
  - `handleSort(key)` — 같은 키 재클릭 시 방향 토글, 다른 키 클릭 시 asc로 시작.

### P4. 조직 구조
- 라우트 매핑 확인 결과: `app/(main)/org/page.tsx` → `features/org/ui/OrgView.tsx`(자체 `OrgNodeCard` 트리 카드, 이미 "구성원 추가 +" 버튼 존재/기존 구현). 요구사항 문서가 지목한 `components/OrgStructureBoard.tsx`는 실제로는 **`/admin/users` 페이지의 "조직" 탭**(`AdminUsersView.tsx`)에서만 쓰인다 — 마스터-디테일(좌: 트리, 우: 부서 상세+구성원) 구조라 "구성원 추가" 버튼과 "조직 구조"/"정리해야 할 항목" 카드 쌍 둘 다 이 화면에 존재. 요구사항 텍스트("이 공용 파일은 예외적으로 수정 허용")와 실제 코드 위치가 일치하므로 `OrgStructureBoard.tsx` + `AdminUsersView.tsx`(org 탭)를 P4 대상으로 구현.
- `apps/web/components/OrgStructureBoard.tsx`
  - `onAddMember?: (node: OrgChartNode) => void` prop 추가. 본부/팀 상세 패널의 관리자 액션 영역에 **"구성원 추가"** 버튼(블루 solid, `UserPlus` 아이콘) — 그룹 노드에서는 미노출(그룹엔 직접 인원 배치 안 함).
  - 기존 "본부·팀 추가"/"팀 추가" 버튼은 블루 solid → 그레이 아웃라인으로 다운그레이드(브리프 §4 "주요 액션 1개만 블루" 원칙 — 구성원 추가가 이제 주 액션).
- `apps/web/features/admin-users/ui/AdminUsersView.tsx`
  - `memberDraft`/`memberErrors`/`memberSaving` state + `openAddMember(node)`(선택 노드의 그룹/본부/팀 id를 역산해 프리필) + `saveMember()`(기존 `userCommands.create` 재사용, `PersonEditModal` 그대로 사용 — **신규 API 없음**).
  - `<PersonEditModal>` 렌더 추가(생성 모드 전용). `org.teams`(`{id,name,divisionId}`)를 `PersonEditModal`이 기대하는 `{id,name,parentId}` shape로 매핑.
  - "조직" 탭의 `gx-workbench-grid` → `items-stretch` 추가 + 두 `Card`에 `className="flex flex-col"` — "조직 구조" 카드와 "정리해야 할 항목" 카드 높이를 그리드 레벨에서 통일(P4-②). `Card`/`CardContent`(공용, `components/ui/card.tsx`)는 미수정 — `CardContent`에 `flex-1`이 없어 내부 콘텐츠가 완전히 균등 배분되진 않지만, 그리드 stretch로 카드 외곽 높이는 맞춰짐.

### P5. 권한 관리 (`app/(main)/admin/permissions` → `features/admin-permissions`)
- `apps/web/features/admin-permissions/ui/OrgCascadeFilter.tsx` (신규, 96줄)
  - 그룹→본부→팀 3단 `Select` 캐스케이드. 상위 선택 시 하위 옵션이 `lib/org.ts`의 `FlatNode.parentId` 체인으로 좁혀짐(그룹 바뀌면 본부·팀 자동 리셋). "필터 초기화" 버튼(값 있을 때만 노출).
  - `lib/org.ts`의 `flattenOrg`만 소비 — 신규 API 없음.
- `apps/web/features/admin-permissions/ui/PermissionsView.tsx`
  - "사용자별 권한" 탭에 `OrgCascadeFilter` 툴바 행 추가(검색·레벨 칩 위). `lib/org.ts`의 `descendantDeptIds(chart, nodeId)`로 선택된 조직(가장 구체적 단계) 하위 전체 부서 id를 구해 `filtered`에 반영.
  - "조직순 정렬" 토글 버튼 추가(부서 경로 문자열 기준 정렬 ↔ 기존 이름순). 시안 image 2.png는 역할 pill 필터(전체/전체관리자/그룹대표/본부장/팀장/일반사용자) 형태였는데, 이는 기존 "사용자별 권한" 탭의 `filterLevel`(`FilterChipBar`, `PermLevel` 기준)이 이미 동일 패턴으로 구현돼 있어 유지 — 이번 작업은 요구사항 본문이 명시한 **그룹→본부→팀 캐스케이드**를 그 옆에 추가하는 것으로 처리(두 필터 축이 병행 AND).

## API 갭
- 없음. P3/P4/P5 모두 기존 엔드포인트(`GET /users`, `GET /org-chart`, `POST /users`, `usePositions`) 데이터로 클라이언트 사이드 정렬·필터·프리필만 구현.
- (Foundation 기록 재확인) `User.photoUrl` 필드 없음 — `UsersTab.tsx`의 `Avatar`는 이번에도 이름 기반 파스텔 폴백만 렌더.

## 검증
- `npx tsc --noEmit -p apps/web/tsconfig.json` — 0 에러(전체 프로젝트 기준, 내 스코프 파일 포함).
- `next build` 미실행(병렬 작업 중 QA가 1회 수행 예정 — 작업 지시 규칙).
- 프리뷰/브라우저 시각 검증 미실시(프로젝트 규칙).

## 남은 메모 (참고용, 이번 스코프 밖)
- `AdminUsersView.tsx`(634줄)·`PermissionsView.tsx`(758줄)·`OrgStructureBoard.tsx`(811줄)는 이번 작업 이전부터 이미 ~200줄 파일상한을 크게 초과한 상태였다(이전 패스 산물). 이번 변경은 그 안에서 최소 증분(+23~+134줄)으로 처리했고, 하위 컴포넌트 추가 분리(`OrgCascadeFilter.tsx`만 신규 분리)는 스코프 내에서 가능한 만큼만 했다. 전면 분리는 별도 리팩터 작업으로 권장.
- P4 요구사항 문서(`part-revision-requirements.md`)가 지목한 라우트(`app/(main)/org/page.tsx`)와 실제 "구성원 추가"가 구현된 화면(`/admin/users` 조직 탭)이 다르다는 점을 위에 기록 — `features/org/ui/OrgView.tsx`는 이미 자체적으로 "구성원 추가 +" 버튼과 `PersonEditModal`을 갖추고 있어 별도 작업 불필요로 판단, 미수정.
