# 전면 디자인 통일 재스킨 요구사항 (2026-06-12)

## 사용자 요청
- **기준(레퍼런스) 화면 3개 — 수정 금지, 이 화면들의 패턴을 추출해 나머지에 적용:**
  - 대시보드: `apps/web/app/(main)/dashboard/page.tsx`
  - 내평가표: `apps/web/app/(main)/eval/my/page.tsx`
  - KPI작성: `apps/web/app/(main)/kpi/page.tsx`
- 나머지 **모든 페이지**를 위 3개 화면의 디자인 언어로 세세한 부분까지 통일.
- 동시에 사용자 친화적 UI/UX 개선(빈 상태, 로딩, CTA 위치, 진행 표시, 폼 검증 피드백, 위계 등) 적용 가능한 것 전부 적용.
- 속도 우선 모드: 화면 그룹별 프론트 에이전트 병렬 팬아웃.

## 대상 페이지 (재스킨)
- eval: self, dept-head, midterm, result, result/[userId], eval(인덱스), competency/eval
- kpi/review, appeals, notifications, org
- reports: 인덱스, yoy, evaluation-summary
- admin: cycle, rules, settings, users, permissions, audit, compensation, group-performance, monthly-performance, kpi-import, competency/items, midterm/rebaseline
- auth: login, onboarding/password (셸 밖이지만 동일 시각 언어)

## 제약
- 백엔드/API 계약 불변. 데이터 훅 로직 유지(시각·UX 레이어만).
- 공용 프리미티브(Button, Card, PageHeader, AppShell 등 여러 그룹이 공유)는 팬아웃 에이전트가 직접 수정 금지(충돌 방지) — 필요 시 progress 노트에 기록.
- AppShell이 페이지 여백 제공 — 페이지에서 추가 외곽 패딩 금지. 타이틀 20px, 대형 수치 ~34px 스케일.
- 검증은 tsc/build까지 (프리뷰 화면 검증 금지).
- git 작업 트리에 기존 미커밋 변경(eval/midterm 일부) 존재 — 보존하고 그 위에 작업.
