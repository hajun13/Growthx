# FE-C — 내 평가표 + 상세 평가표 + 평가결과 시안 재현 (2026-07-02)

SSOT: `_workspace/00_input/part-revision-requirements.md` §P7·P8·P14·§0, `_workspace/01_design/part-revision-brief.md`,
`_workspace/04_frontend/part-foundation-notes.md`(Avatar·gradeSoftClass 등 공용 API — 이 패스에서 소비만, 공용 파일 미수정).

## 범위
- `apps/web/features/eval-my/ui/MyEvaluationView.tsx` (P7 — image 3)
- `apps/web/features/eval-result-detail/ui/ResultDetailView.tsx` (P8 — image 4)
- `apps/web/features/eval-result/ui/EvalResultView.tsx` (P14 — image 10)

공용 `components/`·`lib/`은 수정하지 않음(Foundation 산출물만 소비: `Avatar`, `GradeChip`, `gradeSolidClass`/`gradeSoftClass`, `gradeChipColor`).

## P7. 내 평가표 (`eval-my`)
- 프로필 영역: 이니셜 검정 박스 → `<Avatar name={displayName} size="lg" />`로 교체.
- 평가 결과 요약 3분할 카드: `rounded-none` → `rounded-lg`, `GradeTile`이 `GradeChip`(신규 5색 Solid)을 그대로 사용(기존에도 GradeChip 위임 — 팔레트 교체는 Foundation이 처리, 이 패스는 카드 래퍼만 라운드 복원).
- **진행 스테퍼 신규 구현** — 기존 세로 리스트(`ProcessStepRow`, 완료/진행중/대기 텍스트 뱃지)를 image 3과 동일한 **가로 스테퍼**(`ProgressStepper`/`StepNode`)로 전면 교체:
  - 완료 = `#161326`(진네이비) 원형 + 흰 체크(`lucide Check`)
  - 진행중 = `bg-primary`(블루) 원형 + 흰 숫자
  - 미도래 = 흰 배경 + 회색 보더 원형 + 회색 숫자, 라벨 텍스트도 `text-muted-foreground`
  - 연결선: 완료 구간 `bg-[#161326]` 실선, 미도래 구간 `border-dashed` 회색
  - 각 단계 아래 등급 배지(완료 단계는 `GradeChip size="sm"`, 대기 단계는 흰 배경+회색 테두리 "대기" 박스 — 브리프 §5 그대로)
  - 마감일 표시: 완료 단계는 참고 날짜(있으면), **미도래 단계는 `MM.DD(요일)까지`를 블루 텍스트로**(브리프 §5 패턴). 5단계 구성: 본인평가/1차(팀장)/2차(본부장)/최종(그룹대표)/확정 및 완료.
  - 마감일 소스: `useCurrentPhase(cycleId).schedules`(계약 `PhaseScheduleLite[]`, phase+dueDate) — 기존 훅 그대로 사용, 신규 호출 없음.
- "상세 평가표 보기" 버튼을 블루 solid → **링크형(흰 배경+블루 텍스트, 브리프 §4 "링크형/텍스트 버튼")**로 변경 + "평가결과 상세"도 `rounded-lg`로 통일.
- 사이클 선택 미니 박스 `rounded-none` → `rounded-lg`.

### API 갭 확인(추측 생성 없이 폴백 처리)
- 단계별 완료 일시(`completedAt`)가 `Evaluation` 타입에 없어(계약에 `updatedAt` 미노출), 완료 단계의 "참고 날짜"는 표시하지 않음(빈 문자열) — 프로세스 스케줄 마감일(`dueDate`)만 신뢰 가능한 소스로 사용. 추측 날짜 생성 안 함.

## P8. 상세 평가표 (`eval-result-detail`)
- 요약 카드(이름·소속·종합/성과중심/협업성장 배지)를 `rounded-none` 테두리 박스 → `rounded-lg + shadow-elev-1`(카드+그림자, 검정 박스 스타일 제거).
- 이니셜 박스 아바타 → `<Avatar name={displayName} size="lg" />`.
- `SummaryGradeBox`: 등급 표시를 자체 텍스트(`{grade ?? '–'}`) → **`GradeChip`(통일 Solid 5색)**로 교체. `highlight`(종합) 카드는 블루 1.5px 보더 + `bg-info-50`(브리프 §3 "선택됨" 패턴, `--color-primary-subtle` 상당).
- **신규 `CompetencyRefBox`** 추가 — image 4의 4번째 타일("참고용 역량 평가")을 재현. 등급 미반영이라 GradeChip 대신 점수 숫자 + "참고용"/"미반영" 소프트 배지로 표시(import 결과는 라운드 요약 표만 있어 미노출).
- 평가자 플로우/역량평가/코멘트 카드 내부의 `rounded-none`/`rounded-[4px]` 박스·배지를 `rounded-lg`/`rounded`(8~10px 계열)로 통일. `font-extrabold`(800) → `font-semibold`/`font-bold`로 낮춰 볼드 최소화 규칙(§0-5) 반영.
- `ImportRoundTable` 컨테이너 라운드도 통일.
- `Card`(공용 `components/Card.tsx` → `ui/card.tsx`)는 이미 Foundation 패스에서 `rounded-lg`+`shadow-elev-1`로 교체돼 있어 `<Card title="...">`로 감싼 섹션은 별도 수정 없이 카드+그림자 상속.

## P14. 평가결과 (`eval-result`)
- **상단 요약 카드(전체 대상자/완료자/평균점수/등급비율)는 기존 코드에 이미 없음** — 요구사항 그대로 유지(변경 없음, 현재 구성이 요구사항과 일치).
- 등급 색 하드코딩 제거: `GRADE_TONE`이 `#111111`~`#C8C3BE` 그레이스케일 5단계였던 것을 **`gradeChipColor`(공용 `lib/palette.ts`, 브리프 §2 Solid 세트)**에서 파생하도록 교체 — 등급별 인원 차트(Bar/Cell)·등급 분포 진행바가 이제 S=보라/A=초록/B=주황/C=노랑/D=빨강으로 렌더.
- 대상자 리스트 이니셜 박스 → `<Avatar name={name} size="sm" />`.
- 잔여 `rounded-none`/`rounded-[4px]` 정리: 필터 카운트 pill → `rounded-full`, sticky 테이블 헤더 라운드 제거(불필요한 각짐 제거), 차트 tooltip/막대 radius 8/4px, 등급 분포 진행바 `rounded-full`, 스켈레톤 `rounded-lg`.

## 검증
- `npx tsc --noEmit -p apps/web/tsconfig.json` — 대상 3개 파일(`eval-my`, `eval-result-detail`, `eval-result`) 관련 에러 0건.
- 남아있는 tsc 에러(`dashboard`, `eval-dept-head`)는 **이 세션 시작 전부터 이미 dirty 상태였던 다른 에이전트의 작업물**(git status 확인, P2/P13 범위)이며 이번 FE-C 작업과 무관 — 손대지 않음.
- `next build` 미실행(작업 지시 — QA가 1회 병렬 수행). 프리뷰 검증 미실시(메모리 규칙).

## 남은 갭/후속 권고
- `Evaluation`에 단계별 완료 일시가 없어 P7 스테퍼의 "완료 단계 날짜"가 항상 공란 — backend-engineer와 `updatedAt` 또는 `completedAt` 노출 협의 필요(있으면 image3처럼 완료일 표기 가능).
- `User.photoUrl` 부재는 기존 Foundation 갭 그대로(Avatar 폴백이 사실상 기본값) — 이번 3화면 모두 Avatar로 이미 대응 완료.
