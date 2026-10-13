# T1 / L1 shadcn 프리미티브 정비 브리프 (서브에이전트 공통)

대상: `apps/web/components/ui/*.tsx` (shadcn CLI 가 방금 v4 레지스트리 스타일로 생성/덮어씀 — 함수 컴포넌트, forwardRef 없음). 디렉터리 `C:\Users\user\orca\Growthx`.
**코드 수정 전 `nextjs-frontend` 스킬을 Skill 도구로 먼저 호출.** 먼저 `_workspace/00_input/shadcn-migration/plan.md` 의 §1 결정을 읽어라. 시각 SSOT = 루트 `DESIGN.md`.
이전(구) 구현은 `_workspace/04_frontend/_ui-before/*.tsx` 에 백업돼 있다(Part 토큰 튜닝 참고용 — 구 파일의 클래스/동작을 새 파일이 잃지 않게 비교).

## 해야 할 일 (파일마다)
1. **React 18 호환 — 모든 컴포넌트를 `React.forwardRef` 로 변환.** (Next 14/React 18 은 함수 컴포넌트에 `ref` prop 을 안 넘긴다 → Radix `asChild` 앵커가 끊김.)
   - Radix 래퍼: `React.forwardRef<React.ElementRef<typeof X.Root>, React.ComponentPropsWithoutRef<typeof X.Root>>` + `displayName` 설정.
   - DOM 래퍼: `React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>` 식. **`data-slot="..."` 속성은 반드시 유지.**
   - 훅/콘텍스트로 공유 상태를 쓰는 컴포넌트(Field, ToggleGroup, Calendar, Chart 등)는 기존 로직 유지하고 노출 DOM 루트에만 ref 전달.
   - import 는 `radix-ui` 통합 패키지(`import { Dialog as DialogPrimitive } from "radix-ui"`) 스타일이 이미 쓰였다 — 유지. `cn` 은 `@/lib/utils`.
   - 클라이언트 훅/이벤트를 쓰면 `"use client"` 유지.
2. **Part 하이브리드 디자인 재인코딩** — 겉모습은 기존 앱과 동일해야 한다. 구 파일(`_ui-before`)과 DESIGN.md §2~§7 이 기준.
   - radius 는 테마 재정의: `rounded-sm`=6px(라벨) / `rounded-md`=8px(컨트롤) / `rounded-lg`·`xl`·`2xl`=10px(카드·다이얼로그). 12px 이상 금지. 임의값 `rounded-[…]` 금지.
   - 색은 테마 토큰만: `bg-card`, `text-muted-foreground`, `border-input`, `bg-accent`, `bg-brand-blue-hover`, `text-status-review-fg`, `bg-grade-s`, `bg-danger-50` 등(`packages/ui/theme.css` `@theme`). 새 hex·`bg-pink-500` 금지.
   - 그림자: `shadow-xs`(입력) / `shadow-sm`(카드·패널) / `shadow-md`(드롭다운) / `shadow-lg`(팝오버) / `shadow-xl`(모달) — 전부 옅은 중립 그림자로 테마에 매핑돼 있다. 컬러 섀도 금지.
   - 컨트롤 높이: 입력·셀렉트 트리거 `h-10`(40px; 구 앱 패리티), 버튼은 이미 확정(`ui/button.tsx` 참조 — 다시 건드리지 말 것).
   - 포커스: `focus-visible:ring-2 focus-visible:ring-ring/50`(+ 필요 시 `focus-visible:border-ring`). `outline-none` 대신 `outline-hidden`.
   - 구 파일에 있던 앱 보정(예: `z-[120]` 오버레이 z-index, Modal 85vh+내부 스크롤, DropdownMenu 최대 높이, Tabs 하단 2px 인디케이터)은 **유지**한다 — 임의값은 `components/ui/**` 에서만 허용(lint override).
3. **도메인 variant 는 L1 에 둔다** (cva):
   - `badge.tsx`: variants `default`(accent bg+primary 글씨)·`secondary`·`outline`·`destructive`·`success`·`warning`·`info`·`neutral` **+ 상태 7종** `status-not-started|status-in-progress|status-submitted|status-review|status-revision|status-finalized|status-danger`(`bg-status-*-bg text-status-*-fg`, DESIGN §2) **+ 등급** `grade-s|a|b|c|d`(Solid: `bg-grade-x text-white`, 전 등급 글씨 흰색 — 사용자 확정) · `grade-soft-s|a|b|c|d`(`bg-gradeBg-x text-gradeSoftFg-x`). `shape` variant: `label`(기본, `rounded-sm`, h-[22px]) / `pill`(`rounded-pill`, 상태 배지 기본으로 쓰도록 `pill` 지원). 루트는 `<div>` 이되 `asChild` 불필요. 구 `pill` boolean prop 은 `shape="pill"` 로 교체.
   - `alert.tsx`: variants `default`(=info 톤)·`info`·`success`·`warning`·`destructive`(구 InfoBanner 대체: border-{tone}-100 bg-{tone}-50 text-{tone}-700). 아이콘 슬롯 레이아웃은 shadcn v4 방식 유지.
   - `tabs.tsx`: 기본 = **하단 2px 블루 인디케이터 언더라인**(구 파일 그대로) — pill/line 변형 분기 불필요.
   - `table.tsx`: 헤더 `bg-muted`(#F4F5FA) + 행 구분 헤어라인, 컬러 행 배경 금지(DESIGN §7). 구 파일 값 유지.
   - `card.tsx`: 이미 갱신됨 — `rounded-lg`(10px) + `border` + `shadow-sm`, 내부 패딩은 구 파일(`_ui-before/card.tsx`)과 동일하게 맞춘다(`py-6 gap-6` 기본값이 구 앱과 다르면 구 값 우선).
   - `sonner.tsx`: 구 파일의 Part 토큰 매핑 유지. `toaster` 같은 클래스명이 "unknown class" 로 걸리면 그 클래스명을 제거/치환(lint `no-unknown-classes`).
4. **lint 통과**: `pnpm -C apps/web exec eslint components/ui/<파일>` 가 에러 0 이어야 한다(규칙: `no-raw-colors`·`no-inline-styles`·`no-unknown-classes` 는 ui 에서도 켜짐; 임의값·restyle 은 ui 에서 꺼짐). 정당한 인라인 스타일(progress transform 등)은 CSS 변수 방식으로 바꾸거나 `// eslint-disable-next-line shadcn/no-inline-styles -- <사유>` 로 예외 + 사유.
   - chart.tsx 의 `<style>` 주입·`backgroundColor` 인라인은 shadcn chart 의 본질적 패턴 → 사유 주석과 함께 disable.
5. **소비처 호환**: 구 파일이 export 하던 이름과 prop 은 가능한 유지(grep 으로 `from "@/components/ui/<name>"` 소비처 확인 — 레거시 래퍼 `apps/web/components/*.tsx` 들이 사용 중). 이름이 바뀌는 경우(예: Badge `pill`)는 **소비처 파일을 직접 고치지 말고** 최종 보고에 목록으로 남겨라(L2 재구성 단계에서 처리). 새 shadcn export 는 그대로 둔다.
6. `pnpm -C apps/web typecheck` 로 **자기 소유 파일에서 새로 생긴 타입 에러가 0** 인지 확인(다른 파일의 에러는 보고만 — 동시에 다른 에이전트가 작업 중).
7. **금지:** `next build`/`next dev` 실행, git 파괴 명령(`checkout --`, `restore`, `reset`, `stash`, `clean`, `commit`), 소유 파일 밖 수정(아래 각자 목록 외 파일 수정 금지). `components.json`/`package.json` 수정 금지(필요한 의존성은 보고).

## 최종 보고(짧게): 파일별 변경 요약, 이름/prop 변경으로 소비처에 영향 있는 항목 목록, lint/typecheck 결과 수치, 판단이 필요했던 점.
