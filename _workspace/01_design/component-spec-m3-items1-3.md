# 컴포넌트 스펙 M3 Items 1-3 + 조직도 — 에너지엑스 인사 평가

> **디자인 SSOT:** `DESIGN.md`(shadcn/ui new-york·neutral, Pretendard, Action Blue `#0066cc`, 라이트 고정). **신규 색·radius·폰트 0건.** 신규 토큰 불필요.
> **소비자:** frontend-engineer. props는 TS 표기. 컴포넌트명 확정값(그대로 구현).
> **재사용 우선:** 아래 표 기존 공용 컴포넌트 먼저, 신규는 최소.
> **공통:** 대비 AA · `focus-visible:ring` · `aria-*` · "~해요" 라이팅 · 색 단독 의존 금지(아이콘/텍스트 병기).

---

## 0. 기존 컴포넌트 재사용 매핑 (화면별)

| 화면 | 재사용(그대로) | 신규 컴포넌트 |
|------|----------------|----------------|
| W1 조직도 `/org` | `AppShell`·`PageHeader`·`Card`·`Breadcrumb`·`Tabs`·`ResultTable`·`StatusBadge`·`Badge(ui)`·`Avatar(ui)`·`DropdownMenu(ui)`·`InfoBanner`·`Button`·`Select`·`TextField`·`States`(Spinner/EmptyState/ErrorState) | `OrgTree`·`OrgTreeNode`·`OrgPersonCard`·`OrgViewToggle`·`PersonEditModal`·`OrgNodeEditModal` |
| W2 엑셀 온보딩 | **`FileDropzone`(그대로)**·`Modal`·`InfoBanner`·`ResultTable`·`Toast` | `RosterImportPanel`(FileDropzone 경량 래퍼) |
| W3 비밀번호 강제 변경 | `Card`·`TextField`·`Button`·`Toast` | `PasswordChangeGate`·`PasswordPolicyChecklist` |
| W4 KPI 카테고리 정책 | `Card`·`Tabs`·`Checkbox(ui)`·`InfoBanner`·`Modal`·`Button`·`Toast` | `CategoryPolicyMatrix` |
| W5 가시성 오버라이드 | `Modal`·`Select`·`TextField`·`InfoBanner`·`Button` | `ScopeSelect`(+ `PersonEditModal` 내 통합) |

> 기존 컴포넌트 props는 `component-spec.md`(M1) / `component-spec-m2.md` 참조. 본 문서는 **신규/변경분만** 정의.

---

## 공통 타입 (M3 추가)

```ts
// 직급 — M3 확장 enum(10). 기존 lib/types.ts Position(6) → 본 값으로 확장 필요.
type Position =
  | 'ceo' | 'vice_president' | 'executive' | 'director' | 'principal'
  | 'division_head' | 'team_lead' | 'chief' | 'senior' | 'pro';

// 한글 라벨 매핑(UI 단일 출처 — lib/ui 또는 lib/labels에 둬요).
const POSITION_LABEL: Record<Position, string> = {
  ceo: '대표이사', vice_president: '부대표', executive: '상무', director: '이사',
  principal: '수석', division_head: '본부장', team_lead: '팀장',
  chief: '책임', senior: '선임', pro: '프로',
};

type VisibilityScope = 'self' | 'team' | 'division' | 'group' | 'company';
const SCOPE_LABEL: Record<VisibilityScope, string> = {
  self: '본인만', team: '우리 팀', division: '우리 본부',
  group: '우리 그룹', company: '전사',
};

type OrgNodeType = 'group' | 'division' | 'team';

interface OrgNode {
  id: string;
  type: OrgNodeType;
  name: string;
  parentId: string | null;
  directCount: number;     // 직속 인원
  totalCount: number;      // 하위 포함 인원
  children: OrgNode[];
}

interface OrgChart {
  companyLabel: string;    // "에너지엑스 주식회사" (표시 전용 루트)
  totalCount: number;      // 117
  nodes: OrgNode[];        // 그룹 레벨부터(회사 루트는 표시 레벨에서만 합성)
}

interface OrgPerson {
  id: string;
  name: string;
  position: Position;
  email: string;
  phone?: string | null;
  deptId: string;
  deptPath: string[];      // ["이노베이션그룹","DX본부","DX1팀"] — 본부/팀 없으면 짧음
  role: Role;              // 기존 Role
  visibilityScope: VisibilityScope;
  roleIsOverride: boolean; // 자동기본과 다른지(true면 "수동" 배지)
  scopeIsOverride: boolean;
  active: boolean;
  avatarUrl?: string | null;
}

interface KpiCategoryPolicy {
  // position → 허용 KpiCategory 집합
  matrix: Record<Position, KpiCategory[]>;
}
```

---

## 1. OrgTree / OrgTreeNode — 좌측 조직 트리 (신규)

```ts
interface OrgTreeProps {
  chart: OrgChart | null;
  selectedNodeId: string | null;      // null = 회사 루트(전체)
  query: string;                      // 검색어(필터·자동펼침)
  onQueryChange: (q: string) => void;
  onSelect: (nodeId: string | null) => void;
  editable?: boolean;                 // hr_admin true → 노드 ⋯ 메뉴 + [+ 노드 추가]
  onNodeAction?: (action: 'rename' | 'addChild' | 'move' | 'delete', node: OrgNode) => void;
  onAddRoot?: () => void;
  loading?: boolean;
}
interface OrgTreeNodeProps {
  node: OrgNode;
  depth: number;                      // 들여쓰기(group=0, division=1, team=2)
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  editable?: boolean;
  onNodeAction?: OrgTreeProps['onNodeAction'];
}
```
- **컨테이너:** `Card padding="sm"` 또는 보더 패널(`rounded-xl border-border`). 폭 `w-[300px]`, `sticky` + 내부 `overflow-y-auto`.
- **검색:** 상단 `TextField hideLabel` + leading 검색 아이콘(또는 ui `Input`). 입력 시 매칭 노드 경로만 펼침.
- **루트 행:** "에너지엑스 주식회사" + totalCount 배지(`Badge variant="secondary"`). 클릭=전체 선택(selectedNodeId=null).
- **노드 행:** `flex items-center gap-1.5 rounded-lg px-2 py-1.5`. chevron(접힘/펼침) + 노드명(`text-sm`) + 우측 인원 `Badge`. 들여쓰기 `pl-[depth*16]`.
- **선택 표시:** `bg-primary/[0.06] font-bold text-foreground ring-1 ring-primary/15`(AppShell active 패턴 재사용 — 신규 색 없음).
- **division 생략:** team이 group 직속이면 division 레벨 없이 group 아래 team 직접 렌더(depth 보정).
- **editable:** 노드 hover/포커스 시 `⋯`(`DropdownMenu` ui) — [이름 변경][하위 추가][이동][삭제]. 하단 [+ 그룹/본부/팀 추가](`Button variant="ghost" size="sm" leftIcon Plus`).
- **상태:** loading→`Skeleton` 6행. chart=null·노드 0→"조직이 아직 없어요. 명부를 올려 시작해요." + (editable) [명부 일괄 등록].
- **접근성:** `role="tree"`/`role="treeitem"`·`aria-expanded`·`aria-selected`·`aria-level`. 키보드 ↑↓ 이동·→← 펼침/접힘.
- **반응형:** md↓에서는 부모가 `Collapsible`/`Sheet`로 감싸 "조직 선택" 토글. 트리 자체는 동일.

---

## 2. OrgPersonCard — 인물 카드 (신규)

```ts
interface OrgPersonCardProps {
  person: OrgPerson;
  showAdminMeta?: boolean;            // hr_admin → role·scope 칩 + ⋯ 메뉴
  onEdit?: () => void;
  onMove?: () => void;
  onToggleActive?: () => void;
}
```
- **컨테이너:** `Card padding="sm"`(기존 `rounded-xl border shadow-sm`). 그리드 부모 `grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- **상단행:** `Avatar` 48px(`AvatarFallback`=이름 1글자, avatarUrl 있으면 이미지) + 이름(`text-[15px] font-bold`) + 직급 칩(`Badge variant="secondary"`, `POSITION_LABEL`).
- **소속 경로:** `text-xs text-muted-foreground` — `deptPath.join(' › ')`(본부/팀 없으면 그룹만).
- **이메일:** `text-link`(text-primary) `mailto:`. 연락처: caption + 전화 아이콘. 없으면 "연락처 미등록"(muted).
- **showAdminMeta:** 하단에 role 칩 + scope 칩(`SCOPE_LABEL`). 오버라이드면 "수동" `Badge`(muted) 병기. 우상단 `⋯`(`DropdownMenu`) — [수정][소속 이동][비활성/활성].
- **비활성(active=false):** 카드 `opacity-60` + "비활성" `Badge`(muted). 색 단독 아님(라벨 병기).
- **접근성:** 카드 제목=이름(`<h3>` 또는 강조). 액션은 실제 버튼. 직급/scope는 텍스트로 읽힘.

---

## 3. OrgViewToggle — 카드/리스트 뷰 전환 (신규, 경량)

```ts
interface OrgViewToggleProps {
  view: 'card' | 'list';
  onChange: (v: 'card' | 'list') => void;
}
```
- `Tabs`(2탭, 아이콘 `LayoutGrid`/`List`) 또는 세그먼트 버튼 2개(`Button variant ghost/secondary`로 active 표시). 신규 스타일 없음 — 기존 `Tabs` 권장.
- 리스트 뷰는 `ResultTable` 재사용(열: 이름·직급·소속경로·이메일·연락처·[admin]작업). 카드 뷰는 `OrgPersonCard` 그리드.
- **접근성:** `role="tablist"`, 선택 `aria-selected`.

---

## 4. PersonEditModal — 구성원 추가/수정 (신규, W5 scope 통합)

```ts
interface PersonEditDraft {
  id?: string;                        // 없으면 추가 모드
  name: string;
  email: string;
  groupId: string;
  divisionId: string | null;          // 없음(group 직속) 허용
  teamId: string | null;
  position: Position;
  role: Role;                         // 자동기본 프리필
  visibilityScope: VisibilityScope;   // 자동기본 프리필
  roleOverride: boolean;              // 자동기본 유지/수동
  scopeOverride: boolean;
}
interface PersonEditModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  value: PersonEditDraft;
  // 연쇄 셀렉트 옵션
  groups: { id: string; name: string }[];
  divisions: { id: string; name: string; groupId: string }[];
  teams: { id: string; name: string; parentId: string }[];   // parent = division 또는 group
  errors?: Partial<Record<keyof PersonEditDraft, string>>;
  saving?: boolean;
  onChange: (patch: Partial<PersonEditDraft>) => void;
  onSubmit: () => void;
  onClose: () => void;
  onDeactivate?: () => void;          // edit 모드 위험영역
}
```
- **컨테이너:** `Modal size="md"`.
- **필드:** 이름 `TextField`(필수) · 이메일 `TextField type="email"`(create 필수/편집 readOnly 권장) · 소속 연쇄 `Select`×3(그룹→본부(null 옵션 "본부 없음")→팀(null 옵션 "팀 직속")) · 직급 `Select`(10, 한글 라벨).
- **권한 구획(구분선 아래):** 역할 `Select`(Role 4) + `ScopeSelect`. 둘 다 자동기본 프리필. 사용자가 손대면 `roleOverride/scopeOverride=true`. "자동(직급 기준)"임을 hint로 표기.
- **안내:** `InfoBanner tone="info"` "비워두면 직급에 따라 자동으로 정해져요. 본부장은 형제 본부는 못 봐요(본인 본부만)."
- **create 안내:** "등록하면 초기 비밀번호 1234로 만들어지고, 첫 로그인 때 바꾸도록 안내돼요."(caption).
- **위험영역(edit):** `Modal` 하단 `Button variant` danger ghost [구성원 비활성화] → 확인 `Modal`.
- **검증:** 이메일 형식·중복(서버), 필수 소속(그룹), 직급 필수. 위반 시 해당 필드 `error`.
- **저장:** primaryAction loading. `onSubmit`→ create `POST /users` / edit `PATCH /users/:id`.

---

## 5. ScopeSelect — 가시 범위 선택 (신규, 경량)

```ts
interface ScopeSelectProps {
  value: VisibilityScope;
  onChange: (v: VisibilityScope) => void;
  autoDefault?: VisibilityScope;      // 직급 기준 자동값(표시·되돌리기용)
  disabled?: boolean;
  error?: string;
}
```
- 기존 `Select`(SelectOption=SCOPE_LABEL 5개) 그대로 래핑. label="가시 범위".
- `autoDefault`와 value가 다르면 hint "자동값은 \"○○\"이에요. [자동으로 되돌리기]" 텍스트 링크 제공.
- **접근성:** label 연결, `aria-describedby` hint.

---

## 6. RosterImportPanel — 명부 일괄 온보딩 (신규, FileDropzone 래퍼)

```ts
interface RosterImportPanelProps {
  uploading?: boolean;
  result?: ImportResult | null;       // 기존 lib/types ImportResult 재사용
  onSelect: (file: File) => void;     // POST /excel/import/roster (dry-run)
  onCommit: () => void;               // 유효행 등록(commit)
  onClear?: () => void;
}
```
- **상단 안내:** `InfoBanner tone="info"` "그룹·본부·팀·직급·이름·이메일 6개 열의 .xlsx를 올리면 조직과 구성원을 한 번에 만들어요. 초기 비밀번호는 1234, 첫 로그인 때 바꾸도록 안내돼요."
- **본문:** `FileDropzone`(그대로) — `templateHref="/excel/template/roster"`, `templateLabel="명부 양식 받기"`, `accept=".xlsx"`, `maxSizeMB={5}`, `showCommit`, props 패스스루. 오류표·커밋 버튼은 `FileDropzone` 내장.
- **배치:** W1 헤더 [명부 일괄 등록]→`Modal size="lg"` 안 / `/admin/settings` 온보딩 탭 안. 둘 다 동일 컴포넌트.
- **성공:** `onCommit` 성공 → 토스트 "구성원 117명과 조직을 반영했어요." + 조직도 refetch(부모 책임).
- 신규 시각 0 — `FileDropzone`/`InfoBanner`/`Modal` 조합만.

---

## 7. PasswordChangeGate — 첫 로그인 강제 변경 (신규)

```ts
interface PasswordChangeGateProps {
  onSubmit: (current: string, next: string) => Promise<void>;  // POST /auth/change-password
  onLogout: () => void;
  minLength?: number;                 // 기본 8
  bannedValues?: string[];            // 기본 ['1234']
  submitting?: boolean;
  serverError?: string | null;        // "현재 비밀번호가 일치하지 않아요."
}
```
- **레이아웃:** `AppShell` 미사용. 풀스크린 `min-h-screen bg-background flex flex-col items-center justify-center`. 상단 워드마크 "에너지엑스 인사 평가"(`text-base font-bold`).
- **카드:** `Card`(max-w-[420px]). 제목 "비밀번호를 새로 설정해 주세요" + 안내 본문.
- **필드:** 3× `TextField type="password"`(현재/신규/확인). `serverError`는 현재 비번 필드 `error`로.
- **체크리스트:** `PasswordPolicyChecklist`(아래) — 실시간 통과 표시.
- **버튼:** [비밀번호 변경하고 시작하기] `Button fullWidth`(정책 전부 통과 전 disabled) + [로그아웃] `Button variant="ghost"`.
- **성공:** `onSubmit` resolve → 부모가 `landingPath(role)`로 라우팅 + 토스트.
- **가드 연동(라우팅):** 앱 레벨에서 `mustChangePassword=true`면 `/onboarding/password` 외 라우트 접근 시 리다이렉트(미들웨어/레이아웃 가드). 컴포넌트는 화면만 책임.
- **접근성:** 폼 시맨틱, `aria-describedby`로 체크리스트 연결, 버튼 disabled 사유는 체크리스트로 가시화.

---

## 8. PasswordPolicyChecklist — 정책 체크리스트 (신규, 경량)

```ts
interface PasswordRule { key: string; label: string; passed: boolean; }
interface PasswordPolicyChecklistProps { rules: PasswordRule[]; }
```
- 규칙 행: 통과 `CheckCircle2`(`text-success-600`) / 미통과 `Circle`(`text-muted-foreground`) + 라벨(`text-sm`). **아이콘+색+텍스트 3중 병기**(색 단독 금지).
- 기본 규칙 라벨: "8자 이상이에요" · "\"1234\"가 아니에요" · "두 번 입력한 값이 같아요"(+선택 "현재 비밀번호와 달라요").
- 컨테이너: 연한 박스(`rounded-lg border border-border bg-muted/30 p-3` — 기존 패턴) `aria-live="polite"`.

---

## 9. CategoryPolicyMatrix — 직급×카테고리 권한 (신규)

```ts
interface CategoryPolicyMatrixProps {
  value: KpiCategoryPolicy;            // matrix: Record<Position, KpiCategory[]>
  defaults: KpiCategoryPolicy;         // 자동기본(되돌리기용)
  onChange: (next: KpiCategoryPolicy) => void;
  onSave: () => void;                  // PUT /settings/kpi-category-policy
  onResetDefaults: () => void;
  saving?: boolean;
  dirty?: boolean;
}
```
- **컨테이너:** `Card title="직급별 KPI 카테고리 권한"`. 상단 `InfoBanner tone="tip"`(비직책자 매출·수주 기본 차단 안내).
- **그리드:** `<table>` — 행=Position(10, 한글 라벨), 열=KpiCategory(5, 한글 라벨: 매출액·공정액·수주&영업·협업성과·자기개발). 셀=`Checkbox(ui)`.
  - 열 정렬: 첫 열(직급) `text-left`, 카테고리 열 `text-center`.
  - 첫 열 `sticky left-0 bg-card`(가로 스크롤 대비).
- **편의:** 열 헤더 클릭=열 전체 토글(헤더에 작은 토글 버튼) · 행 끝 "전체" 토글(선택) · [기본값으로 되돌리기]→`Modal` 확인 후 `onResetDefaults`.
- **기본 차단 표시:** 비직책자(책임·선임·프로)×(매출·수주) 셀은 자동기본 미체크. 의도 명시 위해 해당 셀/행에 caption "기본 차단"(muted) 옵션.
- **저장:** dirty면 [정책 저장] 활성, 미저장 이탈 경고(선택). 성공 토스트 "권한 정책을 저장했어요. 다음 KPI 작성부터 적용돼요."
- **접근성:** `<th scope="col">`(카테고리)·`<th scope="row">`(직급), 각 `Checkbox` `aria-label="○○ 직급에 ○○ 허용"`. 색 무관(체크 상태=시맨틱).
- **반응형:** md↓ `overflow-x-auto` + 첫 열 sticky. 매우 좁으면 직급별 카드 스택(직급 1=카테고리 체크 목록).

---

## 변경: 기존 컴포넌트

### AppShell — nav 항목 1개 추가(레이아웃 불변)
- `nav.ts`: `{ key:'org', label:'조직도', href:'/org' }`(roles 미지정=전 역할) — `eval` 위 또는 `dashboard` 아래.
- `AppShell.NAV_ICONS`: `org: Network`(lucide) 추가. `NAV_ICON_TINT`: `org: 'bg-[#ECEBFB] text-[#4B43BD]'`(기존 틴트 팔레트 재사용).
- `activeKeyForPath`: `if (pathname.startsWith('/org')) return 'org';` 추가.
- `AppShellProps.user.positionLabel`은 이미 존재 → `POSITION_LABEL[position]` 주입.

### lib/types — Position enum 확장
- 기존 6값 → M3 10값으로 교체(`vice_president·executive·director·principal` 추가, 기존 `division_head·team_lead·chief·senior·pro·ceo` 유지). `POSITION_LABEL`·`SCOPE_LABEL`은 `lib/ui` 또는 `lib/labels`에 단일 정의.

---

## 토큰 준수 체크 (DESIGN.md)
- **색:** Action Blue `#0066cc`(text-primary·ring) 단일 액센트. 트리 선택·카드 강조 모두 `primary/[0.06]`+`ring-primary/15`(기존 패턴). 시맨틱은 기존 `success-*`/`muted`/`danger-*`(체크리스트·비활성·위험영역)만 — **신규 색 0**.
- **radius:** 카드/배너/패널 `rounded-xl`, 트리 행·드롭존 `rounded-lg`, 칩·뱃지 기존. **신규 radius 0.**
- **그림자:** 카드 기존 `shadow-sm`만. 신규 그림자 0.
- **폰트:** Pretendard. 인원수·카운트 `tabular-nums`. 위계 기존 유지(이름 `text-[15px] font-bold`, caption muted).
- **라이팅:** 전부 "~해요". 직급/scope/상태는 한글 라벨 + 아이콘/색 병기(색 단독 의존 금지).
