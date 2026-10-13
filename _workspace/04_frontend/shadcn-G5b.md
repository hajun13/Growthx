# G5b — admin-users / admin-permissions / admin-audit / admin-settings / notifications + DiffViewer·NotificationItem·CategoryPolicyMatrix

검증: eslint(소유 경로 전체) 0, typecheck 소유 경로 에러 0, 레거시 import grep 0.

## 파일별 변경
- admin-users: AdminUsersView(759→608)·UsersTab·PositionsTab·UserFormModal·LifecycleConfirmModal 전환. 신규 `dialogs.tsx`(DialogShell/ConfirmDialog), `StateViews.tsx`(Forbidden/ErrorState = Empty·Alert), `OrgTabPanels.tsx`, `UserLifecycleDialogs.tsx`. Toast→sonner, 직접 createPortal 오버레이→Radix Dialog, Avatar→ui/avatar+로컬 tone 해시.
- admin-permissions: PermissionsView(896→444) + 신규 `PermissionsParts`·`UsersPermTab`·`MatrixSidebarTabs`·`VisibilityTab`. 커스텀 role=switch 버튼→`Switch`, 자기 권한 차단 모달→`AlertDialog`.
- admin-audit: AdminAuditView를 `AuditTable`(L1 Table bare+sticky head)·`AuditDetailDialog`(Dialog)·`AuditPagination`(ui/pagination+Button)·`Forbidden`으로 분리. SearchInput→InputGroup. 인라인 grid style 제거.
- admin-settings: Card→ui/card, HelpTooltip→ui/tooltip(Button variant=help), 칩→Badge outline.
- notifications: Tabs→ui/tabs(안읽음 카운트 Badge 유지), ErrorState→Alert, EmptyState→Empty, useToast→sonner(에러 8s), 안읽음 카운트→Badge solid-primary pill xs.
- components/DiffViewer: raw table→L1 Table. components/NotificationItem: raw button→Button variant=row. components/CategoryPolicyMatrix: Card/Button/table→L1 (삭제하지 않고 전환).

## 추가한 L1 variant
- `button.tsx`: variant `row`, size `row`·`row-dense` (알림 행 전체가 버튼 — NotificationItem).
- `badge.tsx`: `solid-dark|solid-primary|solid-info|solid-success` (permissions 포크가 추가, audit·notifications 도 사용).

## eslint-disable (3건, 모두 permissions)
`shadcn/require-static-classes` — `DataTable.rowClassName`(공개 API 함수)이 `<Table>` className 으로 오인되어 정적 분석 불가. MatrixSidebarTabs 2곳·VisibilityTab 1곳.

## 패리티 메모
- DiffViewer: TableHead 높이 40px·bg-muted 헤더(기존 무배경 헤더), 셀 패딩 py-2.5(기존 py-2), 변경 값 강조는 셀 전체 배경→인라인 블록. 행 align-top 이 td 의 align-middle 에 가려져 세로 가운데 정렬.
- CategoryPolicyMatrix: 표 패딩 py-2.5, 열 토글은 `ghost-muted xs` 버튼.
- admin-audit: Table 래퍼(스크롤 컨테이너 이중 방지 `bare`) — sticky 헤더는 페이지 스크롤 기준(기존 동일). 엔티티 칩=Badge solid-dark xs(h-5, font-medium).
- permissions/users 포크 메모: 상태 스위치 모양이 기본 Switch(pill)로, 레벨 배지 22px·font-semibold, 일괄 버튼 link/secondary, 확인창 role=alertdialog, 다이얼로그 ESC·오버레이 닫기 허용(저장 중 제외), 모달 폭 420→400.

## 보류/질문
- 200줄 상한 초과: AdminUsersView 608, PermissionsView 444 (상태·핸들러 집중 — 훅 추출 필요).
- `Forbidden` 이 admin-users/admin-audit/admin-permissions 에 각각 로컬 사본 — 공유 L2(`components/ui/empty` 조합) 승격 요청(T-integrate).
- raw `<label>` 이 admin-users 에 일부 남음(lint 비대상).
- OrgNodeModal·PersonEditModal·OrgStructureBoard 는 G5a 소유(AdminUsersView 가 import).
