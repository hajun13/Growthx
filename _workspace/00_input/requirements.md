# 인사평가 솔루션 — 요구사항 정규화 (00_input) · v2 (도메인 대정정 반영)

> 리더가 PPT 운영계획 + KPI 양식 xlsx를 재확인해 정규화한 단일 입력. **권위 자료 우선, 레퍼런스 이미지는 참고만.**
> **SSOT:** `.claude/skills/eval-harness-orchestrator/references/{domain-model,business-rules,api-contract-convention,tds-design-language,reference-ui-screens}.md`
> **⚠️ v2 정정(권위 자료 재확인):** ①역량평가 폐기(PPT·xlsx에 없음) ②다면평가(수평/상향) 폐기 → **self + downward(1차 팀장·2차 본부장)** ③조직 **그룹→본부→팀→개인 4단계**(그룹 최상위) ④등급 풀 = **그룹** 단위 ⑤KPI 2그룹·측정방식별 등급(xlsx).

## 1. 제품 개요
에너지엑스㈜ 2026 KPI/성과평가 운영을 시스템화한 사내 인사평가 웹 SaaS. "열심히 한 사람이 아니라 성과를 만든 사람이 평가받는 구조". 공정성·정량성·투명성.

핵심 메커니즘(전부 시스템 강제):
- KPI 연계: **그룹 → 본부 → 팀 → 개인** (`parentKpiId`)
- **그룹 성과 기반 등급 풀**: 그룹 실적(매출·수주·이익률) tier가 구성원 S/A/B/C/D 분포 상한 결정
- 정량 중심 + 코멘트 의무화: 수치 목표 필수, 정성 ≤30%, 본부장·팀장 코멘트 분기 필수
- 성과-보상 연동: 확정 등급 → 인상률(전사 평균 ≈3%)

## 2. 역할(4)·직책(6)
역할: hr_admin / division_head(본부장·2차 평가자) / team_lead(팀장·1차 평가자) / employee. 직책: ceo·division_head·team_lead·chief·senior·pro. ceo는 전사 열람 시 hr_admin 부여.

## 3. 조직 (4단계, 그룹 최상위)
`group(그룹) → division(본부) → team(팀) → 개인`. Department.type = group/division/team.

## 4. KPI 분류 (xlsx 기준 — 둘 다 필수 포함)
- **성과 중심 지표 `performance_core` (70/80%):** 매출액(revenue)·공정액(construction)·수주&업무수행성과(orders)
- **협업 및 성장 지표 `collaboration_growth` (20/30%):** 협업성과(collaboration)·자기개발(development)
- 측정방식 `measureType`: amount(달성금액→달성률)·rate(증감률)·count(건수)·qualitative(정성). 측정방식별 등급(business-rules §2).

## 5. 평가 유형 (다면 없음)
- `self` 본인평가(KPI 실적 자기 입력)
- `downward` 부서장 평가 — round 1(팀장)·2(본부장), **코멘트 필수**
- 종합 = self(참고) + downward 1차 + 2차 가중 집계 → `EvaluationResult`(finalGrade·percentile·byType).

## 6. 규칙 (RuleSet, 2026 seed)
- 등급척도(점수→등급): S 96~100/A 91~95/B 85~90/C 80~84/D <80
- 측정방식별 달성률→등급: amount/rate 110%초과 S…<90 D / count 임계값 KPI별
- 그룹 풀(tier별 상한): excellent/standard/poor — 초과 시 제출 차단
- 가중치 합=100, 정성≤30%, 성과중심 70/80 + 협업·성장 20/30
- 인상률 S+7/A+5/B+3/C+1/D 0, 전사 평균 ≈3%
- 점수 흐름: KPI 실적→측정방식별 등급→점수→가중총점→최종등급→그룹 풀 조정→finalized

## 7. 상태 머신
Cycle draft→active→mid_review→calibration→closed / Kpi draft→submitted→approved→confirmed(반려·수정요청→draft) / Evaluation not_started→in_progress→submitted→finalized / Appeal submitted→under_review→answered→closed

## 8. 화면 범위 (전체 — 다면평가 화면 없음)

### 핵심 (재빌드: 기존 M1 코드를 새 도메인으로 정정)
- 전역 AppShell(상단탭+역할별 사이드바), (auth)/login
- **인사평가 메인** — 주기 단계 일정(평가준비→본인평가→1차 팀장→2차 본부장→결과), 내 할 일
- **KPI 작성·제출** — category·group·measureType·목표값·가중치(합100·정성≤30)·상위연계
- **KPI 검토·승인/반려** — 팀장/본부장, 코멘트 필수
- **본인평가(self)** — 탭 = **성과중심 / 협업·성장**(역량 탭 없음). KPI별 실적 입력 → 달성률→등급 자동표시(백엔드 계산)
- **평가결과 상세** — 종합(finalGrade·percentile) + 유형별(self/1차/2차) 비교 + 코멘트

### M2 확장 (신규 — 다면 제외)
- **부서장 평가(downward)** — 1차 팀장·2차 본부장. 팀원 일괄 점수/등급 + 코멘트 필수 + 그룹 풀 분포 표시(DistributionBarChart)
- **등급 분포 모니터링/리포트** — 그룹/본부/팀 등급 분포, 결과 테이블(직책 체계), 개인 리포트
- **그룹 실적·등급 풀 산정** — hr_admin: 그룹 실적 입력→tier 분류→풀 적용
- **이의제기(Appeal)** — 신청(7일)·1차 팀장 답변·HR 최종 결정
- **보상 시뮬레이션** — 등급→인상률, 전사 평균 모니터링
- **관리자 설정** — RuleSet(등급·풀·인상률·가중치) 편집, KPI 양식(jobLevel별), 일정·대상자
- **알림** — D-7/D-1/D-3

## 9. 비기능
- 경계면 규율(봉투·camelCase·계약우선), 보안(전 엔드포인트 백엔드 RBAC), 접근성 AA, 데스크탑 우선 반응형, "~해요" 라이팅
- 실행 환경 주의: 이 개발 머신에 Node 미설치 → 빌드는 코드 일관성으로 보장, 배포 단계서 빌드 검증

## 10. 재빌드 지침 (부분 재실행)
기존 `apps/api`·`apps/web`·`_workspace/01_design`은 옛 도메인 기반. **새 SSOT로 정정 재작성**하되, 재사용 가능한 인프라(봉투 인터셉터·RBAC 가드·scoring 골격·lib/api·공통 컴포넌트)는 유지하고 도메인 부분만 교체. 옛 산출물은 참고로 읽되 역량/peer/upward/EvaluationItem 잔재는 제거.
