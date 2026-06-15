# 재스킨 그룹 C 결과 — 평가 인덱스·평가결과·역량평가

작업일: 2026-06-12
담당: frontend-engineer (nextjs-frontend 스킬)

---

## 변경 파일 목록

| 파일 | 변경 유형 | 주요 내용 |
|------|----------|----------|
| `apps/web/app/(main)/eval/page.tsx` | 변경 없음 | 이미 `/dashboard` 영구 리다이렉트 — 재스킨 대상 없음 |
| `apps/web/app/(main)/eval/result/page.tsx` | 스타일·UX 개선 | Skeleton, 빈 상태 action, sticky 헤더, 드릴다운 hover 강화 |
| `apps/web/app/(main)/eval/result/[userId]/page.tsx` | Kinetic 통일 | CSS 변수(bg-muted 등) → Kinetic 인라인, 역량카드·코멘트·합산방식 재스킨 |
| `apps/web/app/(main)/competency/eval/page.tsx` | UX 개선 + 하단 바 | 하단 고정 액션 바, 참고용 배너 강화, 진행률 바, 카드 수치 스케일 |

---

## 상세 변경 내역

### 1. `eval/result/page.tsx` — 평가결과 목록

- **로딩 스켈레톤**: `Spinner` → `EvalResultSkeleton()` 함수로 교체. 분포 카드·차트·필터·테이블 레이아웃과 동일한 그리드로 구성. `if (loading && !results.length)` 패턴으로 재로드 시 스크롤 리셋 방지
- **빈 상태 action 버튼**: 필터 적용 중 결과 없으면 "필터 초기화" 버튼 자동 표시. 전체 빈 상태와 필터 결과 없음을 distinction하여 메시지 분리
- **테이블 헤더 sticky**: `position: sticky, top: 0, zIndex: 10` 적용. 결과 10건 이상 스크롤 시 헤더 고정
- **드릴다운 row hover 강화**: 배경 surfaceLow + 왼쪽 3px border `#3f2c80` 보라 틴트로 "클릭 가능" UX 강조 (이전: 배경만 변경)
- **EmptyState 컨테이너**: `!current` 분기에 `PageContainer` 래핑 추가해 레이아웃 일관성 확보

### 2. `eval/result/[userId]/page.tsx` — 평가 상세결과

- **역량평가 카드 재스킨**: `text-muted-foreground` → Kinetic `#484551`, `text-foreground` → `#191c1f` 인라인 스타일로 교체. 숫자 32px/800 스케일(tabular-nums). 배경을 `#f2f3f7` 정보 그리드 패턴으로 교체해 "참고용" 시각 분리 강조
- **역량 카드 타이틀**: `"역량평가 (참고용)"` → `"역량평가 (참고용 — 연봉·등급 미반영)"` 으로 강화
- **평가 코멘트 빈 상태**: `<p className="text-sm text-muted-foreground">` → 아이콘+안내 패턴으로 교체
- **평가 코멘트 스타일**: `border-primary` CSS 변수 → `#3f2c80` 인라인. `border-border` → `#cac4d2`. 최종 배지: `bg-primary` → `background: '#3f2c80'` 인라인
- **합산 방식 배지**: `bg-muted/40 text-muted-foreground border-border` → Kinetic 인라인 스타일. 예외 케이스는 앰버 배경 유지
- **아바타**: `borderRadius: 12` 명시 추가

### 3. `competency/eval/page.tsx` — 역량평가 작성

- **참고용 강조 배너**: PageHeader 아래 보라 틴트 인라인 배너 추가. BookOpen 아이콘 + "연봉·등급 미반영" 강조(빨간 글씨). 기존 InfoBanner success(제출완료) 유지
- **하단 고정 액션 바**: PageHeader right 슬롯에서 제거 → `fixed bottom-0 left-0 lg:left-64 right-0 z-30` 고정 바로 이동. 좌측: 진행 요약(answeredCount/total + 미니 진행바 + %). 우측: 임시저장(outline purple) + 최종 제출(solid blue). 미제출+문항있을 때만 표시
- **진행률 바 신규**: 카드 하단 4px 바 (blue→teal 완료 전환). 완료 카드에서도 tabular-nums 수치 34px 스케일 통일
- **스켈레톤 개선**: `qLoading && !qData` 패턴으로 첫 로딩만 스켈레톤, 5개 블록으로 실제 레이아웃 반영
- **EmptyState 컨테이너**: `!current` 분기 PageContainer 래핑
- **textarea focus glow**: `onFocus/onBlur` blue glow 패턴 추가

---

## UX 개선 핵심

1. **로딩 → 스켈레톤 일원화**: Spinner → 레이아웃 동형 Skeleton으로 교체(목록·상세 모두). 재로드 시 전체 교체 방지
2. **빈 상태 action 버튼 강화**: 필터 있으면 "초기화", 없으면 안내 메시지만 — 상황별 분기
3. **하단 고정 액션 바**: 역량평가 저장/제출 버튼을 header에서 하단 고정 바로 이동 + 진행률 요약 병기
4. **참고용 배너 강화**: 역량평가 참고용 안내를 배너+카드 타이틀 두 곳에 표시, "연봉·등급 미반영" 빨간 강조
5. **드릴다운 hover**: 결과 목록 행 hover 시 보라 3px 왼쪽 border로 "클릭 가능" UX 강도 향상

---

## CSS 변수 교체 내역 (Kinetic 통일)

| 교체 전 | 교체 후 | 위치 |
|---------|---------|------|
| `text-muted-foreground` | `color: '#484551'` | [userId]/page.tsx 역량·코멘트 카드 |
| `text-foreground` | `color: '#191c1f'` | [userId]/page.tsx 코멘트 카드 |
| `bg-muted/40` | `background: '#f2f3f7'` | [userId]/page.tsx 합산방식 배지 |
| `bg-muted-foreground` | `background: '#797582'` | [userId]/page.tsx 합산방식 배지 |
| `border-border` | `border: '1px solid rgba(202,196,210,0.5)'` | [userId]/page.tsx 합산방식, 코멘트 |
| `border-primary` | `borderLeft: '3px solid #3f2c80'` | [userId]/page.tsx 코멘트 강조 |
| `bg-primary` / `text-primary-foreground` | `background: '#3f2c80', color: '#fff'` | [userId]/page.tsx 최종 배지 |

---

## 공용 컴포넌트 변경 요청 사항 (이번 작업에서 수정 금지 — 기록만)

- **EmptyState `action` prop**: `States.tsx` 확인 결과 `action?: React.ReactNode` 이미 지원됨 (`<div className="mt-2">{action}</div>`). 별도 변경 불필요
- **EvaluatorFlow, ComparisonBar**: 기준 3화면이 아닌 담당 파일 전용 컴포넌트이나, 현재 사용처를 grep 확인 시 `eval/result/[userId]/page.tsx` 외 사용 없음 → 이번 작업에서는 수정하지 않음(시각 로직 불변)

---

## Typecheck 결과

`npx tsc --noEmit` 실행 결과:
- 담당 파일(eval/result/*, competency/eval/*) 에러: **0건**
- 기존 에러 `OrgStructureBoard.tsx` 다수: 이번 작업 범위 밖, 기존에도 존재하던 에러 (미커밋 변경사항)
