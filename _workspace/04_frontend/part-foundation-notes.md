# Part/ Foundation — 공용 토큰·컴포넌트 교체 (2026-07-02)

SSOT: `_workspace/01_design/part-revision-brief.md`. 이 패스는 공용 계층만 수정했다(`features/*` 미접촉).
페이지별 에이전트는 이 문서의 "신설 API" 섹션을 그대로 소비하면 된다.

## 수정 파일

### 색·라운드·그림자 토큰
- `packages/ui/tailwind-preset.cjs` — `grade`/`gradeFg`/`gradeBg`(신규 `gradeSoftFg`) 5색 교체, `primary`/`info`/`neutral`/`success`/`warning`/`danger` 스케일을 액션 블루(#0257CE)·신팔레트로 리맵, `status.*`/`chart.*`/`pool.*` 갱신, `borderRadius`(카드 10px·컨트롤 8px) 기본값 복원, `boxShadow.elev-*`를 보라 틴트 soft shadow로 교체, 신규 `sidebar`/`brand` 원시 토큰 추가.
- `apps/web/app/globals.css` — `:root`(light) CSS 변수(`--background` #F8F9FD, `--primary` #0257CE hsl 등) 전체 교체, `--ex-radius-*` 기본값을 8~10px로 복원, `.gx-*` 컴포넌트 클래스(패널/토스트/컨텍스트밴드/액션버튼/레일) fallback hex를 신팔레트로 교체 + radius/shadow 복원. `.gx-action-button`(보조 버튼) 텍스트를 블루→그레이로 수정(브리프 §4 "보조 액션은 그레이" 규칙 위반이던 기존 코드 버그 수정). `.dark`는 브리프 범위 밖이라 미변경.
- `packages/design-system/styles/color-tokens.css` — `--gx-*` light 모드 원시 변수(진짜 SSOT, `button.css`/`globals.css`의 모든 fallback이 여기서 옴) 전체 교체. dark/high-contrast는 미변경(브리프 범위 밖).
- `packages/design-system/styles/button.css` — `--button-radius` 4→8px, contained/outlined/text 색 변수 신팔레트로 교체. **보조(outlined) 버튼 텍스트를 블루→그레이(`--gx-text-secondary`)로 수정** — 기존엔 outlined도 블루 텍스트였음(브리프 §4 위반).
- `packages/design-system/styles/chip.css` — `--chip-label-radius` 4→9999px(Pill), primary/red/secondary hex 교체. (`apps/web`에서 `ds-label` 클래스 미사용 확인 — 낮은 우선순위지만 일관성 위해 반영. `input.css`/`select.css`/`tabs.css`/`toast.css`/`confirm-dialog.css`/`tooltip.css`는 `apps/web`에서 해당 `ds-*` 클래스가 전혀 쓰이지 않아 미접촉.)

### 등급·색 헬퍼
- `apps/web/lib/palette.ts` — `T` 팔레트 전체를 브리프 §1 값으로 교체(blue500→#0257CE 등), 신규 `T.sidebar`/`T.sidebarActive`/`T.teal`/`T.tealSubtle` 추가. `groupChip`/`categoryChip`은 브리프에 지정 없어 새 그레이 스케일로만 remap(구조 유지). `gradeChipColor` 5색을 브리프 §2 Solid 세트로 교체(C만 진갈색 텍스트 `#3D2900`). 신규 `gradeChipSoftColor` export 추가(Soft 세트).
- `apps/web/lib/ui.ts` — `gradeSolidClass`를 프리셋 `gradeFg-*`(C만 진갈색) 참조로 수정, 신규 `gradeSoftClass` export(연한 배경+진한 텍스트, "등급 색상 가이드" 등 부차 표시용). 기존 `gradeBgClass`는 미사용 확인 후 페어링만 Soft로 정정(`@deprecated` 마킹, 파괴적 변경 없음).
- `apps/web/components/GradeChip.tsx` — 구조 변경 없음(`gradeSolidClass` 자동 갱신 수혜), 주석만 갱신.

### 신규 컴포넌트
- `apps/web/components/Avatar.tsx` — 신설. §6 스펙대로 `photoUrl`/`name`/`size` prop, 파스텔 5색 이름-해시 로테이션 폴백, `onError`로 사진 로드 실패 시 폴백 전환.

### 검은/진한 배경 이니셜 → Avatar 교체
- `apps/web/components/EvaluationSubjectPanel.tsx`
- `apps/web/components/EvaluationDetailHeader.tsx`
- `apps/web/components/MidtermResultSummary.tsx` (2곳: 본인 아바타, 부서장 리뷰어 아바타)
- `apps/web/components/EvalReport.tsx` (인쇄 리포트 포털 — `GRADE_HEX`/`GRADE_FG`도 신팔레트로 교체, C 등급 흰글씨 버그 수정)
- `apps/web/components/OrgStructureBoard.tsx`
- `apps/web/components/OrgPersonCard.tsx` (shadcn `Avatar`/`AvatarImage`/`AvatarFallback` → 공용 `Avatar`, `person.avatarUrl` 실사진 필드 그대로 연결됨)
- `apps/web/components/CommentThread.tsx` (shadcn Avatar → 공용 Avatar)
- `apps/web/components/ActionItemFormModal.tsx` — 확인 결과 이니셜/아바타 렌더 없음(수정 불필요).

### 사이드바·셸
- `apps/web/components/AppShell.tsx` — `SIDEBAR` 토큰을 보라(#564599) 배경 + 흰 텍스트로 교체(활성 #4A3B85). 로고에 흰 배경 칩 추가(보라 배경 위 대비 확보 — 로고 원본이 밝은 배경 전제라 흰 pill 없이는 대비 리스크). 잔여 하드코딩 hex(알림 뱃지·아이콘) `#C23A3A`→`#EF4444`, `#74747F`/`#565660`→`#6B6980` 정렬.

### 카드·버튼 프리미티브
- `apps/web/components/ui/card.tsx` — `rounded-none`/`shadow-none` → `rounded-lg`(10px)/`shadow-elev-1`(브리프 §3).
- `apps/web/components/ui/button.tsx` — `rounded-[4px]` → `rounded-[8px]`(브리프 §4). variant 구조(default=블루 solid, outline/secondary=그레이)는 이미 브리프에 부합해 그대로.

## 신설 API (페이지 에이전트 소비용)

```ts
// apps/web/components/Avatar.tsx
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'; // 24 / 32 / 40 / 56px
export interface AvatarProps {
  photoUrl?: string | null; // 있으면 사진, 없거나 로드실패면 파스텔 이니셜 폴백
  name: string;             // 폴백 이니셜(첫 글자) + 해시 기반 색 로테이션 시드
  size?: AvatarSize;        // 기본 'md'
  className?: string;
}
export function Avatar(props: AvatarProps): JSX.Element;
```

```ts
// apps/web/lib/ui.ts
export const gradeSolidClass: Record<Grade, string>; // 배지 본체 — 항상 이것만 (브리프 §2)
export const gradeSoftClass: Record<Grade, string>;  // 신규 — 연한 배경+진한 텍스트, 설명/보조 표시 전용
```

```ts
// apps/web/lib/palette.ts
export const gradeChipColor: Record<string, { bg: string; color: string }>;     // Solid 인라인 스타일용
export const gradeChipSoftColor: Record<string, { bg: string; color: string }>; // 신규 Soft 인라인 스타일용
```

Avatar 사용 예:
```tsx
<Avatar name={user.name} photoUrl={user.avatarUrl /* 있는 도메인만 */} size="sm" />
```

## API 갭
- `User.photoUrl` 필드 없음(OrgPerson만 `avatarUrl` 보유) — 대부분 화면은 Avatar 폴백이 사실상 기본값. 백엔드 확장 시 `photoUrl` prop만 채우면 즉시 실사진으로 전환.

## 검증
- `tsc --noEmit -p apps/web/tsconfig.json` — 0 에러.
- `next build`(apps/web) — 컴파일 성공, 35 라우트 전부 생성 성공(정적/동적 포함), 타입체크 통과.
- 프리뷰/브라우저 시각 검증은 프로젝트 규칙(no-preview-verification)에 따라 미실시.

## 페이지 에이전트 유의사항
- `features/*`는 이 패스에서 전혀 건드리지 않음 — 각 화면 담당 에이전트가 `Avatar`/`gradeSoftClass`/`gradeChipSoftColor`를 import해서 자기 feature 안의 이니셜 원·등급 배지를 교체하면 된다.
- 기존 클래스명 계약(`bg-grade-s`, `text-gradeFg-c` 등) 유지 — 이미 이 클래스를 쓰던 코드는 별도 수정 없이 새 색을 자동으로 받는다.
- 버튼: `<Button variant="primary">`(승인/주요, 블루 solid) vs `<Button variant="secondary">`(반려/수정요청, 그레이 outline) 규칙이 이미 `Button.tsx`/`getButtonClasses`에 반영돼 있음 — feature 코드에서 반려 버튼에 `variant="danger"` 등 빨강 solid를 쓰고 있다면 브리프 §4 위반이니 `secondary`로 교체 필요.
