# shadcn 전환 노트 G6a — RuleSetEditor + admin-rules

## 파일별 변경
- `components/RuleSetEditor.tsx`(2122→226줄): 공개 API 유지(`RuleSetEditor`, `validateRuleSet`, 타입 `RuleSetDraft`/`RuleSetEditorProps` 재export). 좌측 메뉴=`Button variant/size="row-select"`+`data-active`, 셸=`Card`.
- 분리(전부 `components/RuleSetEditor*`): `Model.ts`(타입·상수·validateRuleSet 원문 그대로) / `Parts`(ContentHeader·HintBox·RuleError(L1 FieldError)·SumStatus·GradeBadge(`Badge grade-*`)·TierBadge(`Badge info|neutral|warning pill`)·AxisTicks·ToggleRow(`Switch`)) / `Stepper`(`InputGroup`+`InputGroupButton icon-xs`+`InputGroupInput`; `width` 숫자 prop → `className` 폭 클래스) / `Grade` / `Bands`(탭=`ToggleGroup type=single outline`) / `Pool` / `Raise` / `Bonus` / `Stages` / `Weights`.
- `features/admin-rules/ui/RulesView.tsx`(443→234): 레거시 Button/Card/Modal/Toast/InfoBanner/States → L1(`Button`, `Dialog`, `Alert`, `Skeleton`, sonner). 신규 `draft.ts`(toDraft/toPatchBody/기본값/subtitle 이동, 로직 불변), `ui/RulesSummary.tsx`(요약·점검 Card), `ui/RulesStates.tsx`(Forbidden/Empty/Error → `Empty`/`Alert`).

## 예외 / 추가 variant
- eslint-disable 0건. L1 variant 추가 0건(기존 `row-select` 재사용).

## 패리티 메모
- Stepper: 분리된 3조각 박스 → 단일 `InputGroup`(h-9/big h-11, 양끝 ghost +/− 아이콘 버튼 24px, 접미사 우측). number input 네이티브 스피너 숨김 없음(원본과 동일). 폭이 좁은 곳(w-31)은 숫자 영역이 원본보다 약간 좁음.
- GradeBadge: 26px/22px 임의 크기 → `grade-md`(24px)/`grade-sm`(20px). C 등급 글씨 진갈색(`text-gradeFg-c`, 가이드 정책).
- Card 셸에 `shadow-sm` 추가(원본 무그림자). 좌측 메뉴 행 사이 헤어라인은 래퍼 div 로 유지.
- 측정방식 탭: `aria-pressed` 버튼 → Radix ToggleGroup(role=radio, aria-checked). 라벨 텍스트 동일 — 버튼 role 로케이터를 쓰는 E2E 가 있으면 확인 필요.
- 안내 박스(HintBox·재산정 배너)는 `role=alert` 남발 방지 위해 Alert 대신 토큰 div. 저장 확인 모달은 Dialog(`aria-describedby` 생략).
- RuleError 는 L1 `FieldError`(role=alert) 사용 — 검증 오류 노출 시 스크린리더 알림 추가.
- 막대 애니메이션 `transition-all duration-150`(원본 left/width .15s).

## 보류/질문
- 없음. 소유 밖 수정 없음. (`pnpm typecheck` 전체는 타 그룹 파일 구문 오류로 실패 중 — 내 파일은 전용 tsconfig 로 0건 확인.)
