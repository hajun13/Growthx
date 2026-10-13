# shadcn G5a — 조직 보드·노드/구성원 모달·features/org

## 파일별 변경
- `components/OrgStructureBoard.tsx` (931→466줄): 인라인 style 전량 → 토큰 클래스. 트리 행·검색(InputGroup)·좌우 레이아웃(flex)·빈 상태(Card). 상태/드래그/검색/포커스 로직 불변. 우측 상세·구성원 카드는 분리.
- `components/OrgStructureBoardParts.tsx` (신규): 라벨/ACCENT 정적 룩업 맵, `DragItem`, `OrgMemberCard`.
- `components/OrgStructureBoardDetail.tsx` (신규): `OrgDetailPanel`(헤더·브레드크럼·관리자 액션·하위 조직 칩·구성원 드롭 영역).
- `components/OrgNodeModal.tsx`: Modal→Dialog, TextField→`TextFieldRow`, 유형 선택 버튼→ToggleGroup(single/outline, 해제 불가 유지). create/rename 두 분기의 TextField를 하나로 합침(순서·문구 동일).
- `components/PersonEditModal.tsx`: Modal→Dialog(size md), TextField/Select/raw label→`TextFieldRow`/`SelectFieldRow`(label htmlFor 연결 — 날짜 필드 라벨이 이제 입력과 연결됨), Button danger→destructive.
- `components/PersonEditFields.tsx` (신규): Label+Input/Select 조합 행(에러·힌트·aria-invalid).
- `features/org/ui/OrgView.tsx` (552→381줄): Button/Card/Modal/States/SegmentedControl/useToast → L1(sonner toast, Dialog, Alert, ToggleGroup, Card). 삭제 확인은 AlertDialog 대신 Dialog 유지 — AlertDialogAction 이 자동 닫힘이라 "로딩 중 유지·성공 시에만 닫힘" 동작이 달라지기 때문.
- `features/org/ui/OrgChartCard.tsx`, `OrgListView.tsx`, `OrgEmpty.tsx` (신규, OrgView 에서 분리). ListView 는 L1 Table 로 전환(2fr/1fr/1fr grid→w-1/2 + 자동).

## eslint-disable 예외: 0건
## 추가한 L1 variant
- `Button size="inline"` (`h-auto gap-1 rounded-sm p-0 text-xs font-normal`) — 브레드크럼·소형 텍스트 버튼용. button.tsx 에 추가만 함.

## 패리티 메모
- Card 사용처는 L1 `shadow-sm` 적용(구 보드 패널은 shadow 없음).
- 트리 접기 토글: 투명 → ghost 버튼(hover 시 연한 파랑 배경), 14px 유지, 아이콘 색은 svg 자체에 지정.
- 부서장/부그룹장 지정 버튼: 11px→12px 글씨(Button xs, h-6), 활성은 border-primary 틴트 대신 `secondary` variant.
- 하위 조직 칩: 3px 좌측 보더 → 절대배치 바(overflow-hidden), 폰트 동일.
- 상세 패널·트리 높이(`calc(100vh - 280/340px)`)·멤버 그리드(`repeat(auto-fill,minmax(300px,1fr))`)는 임의값 금지 규칙 때문에 CSS 변수(`--mh`/`--cols`) + `max-h-(--mh)`/`grid-cols-(--cols)` 로 전달 — 반복되면 T1 에 토큰 승격 권장.
- 빈 상태(OrgEmpty): L1 Empty 에 border-dashed 만 있고 border 폭이 없어 테두리 없음.
- 목록 뷰: 그룹 행 배경 틴트 제거(DESIGN 컬러 행 금지), Table 기본 헤더/행선.
- 검색 입력 높이 h-8, 배경 흰색(구 grey50).
- OrgNodeModal ToggleGroup 에 aria-label="조직 유형" 추가(접근성 이름 추가, 기존 이름 불변).

## 보류/질문
- `@/components/Avatar`(L2) 를 OrgStructureBoardParts 에서 계속 사용 — 가이드 §4 는 L2 Avatar 유지, 브리프 grep 목록에는 포함. 해시 폴백 로직 중복을 피하려 유지(T9 에서 Avatar 처리 방향 결정 필요).
- OrgStructureBoard.tsx 466줄: 트리 렌더가 상태 클로저라 더 쪼개면 재마운트 방지 설계가 깨져 유지.
