# 요구사항 — 연도 누적(YoY) 평가 비교 시스템

> 작성: orchestrator(리더) · 2026-06-05
> 목표: 작년(2025) KPI 인사평가 결과를 DB에 적재하고, **연도를 누적**해 비교하는 기능을 추가.
> 특정 연도 비종속 — 2024·2025·2026… N개 사이클을 동적으로 비교.

## 1. 배경 / 원본 데이터

원본: `C:\Users\user\Downloads\2025년도 KPI 인사평가 최종 결과 1.xlsx`
- 시트 `평가자정리`(권위) — 88명, 헤더는 4·5행(2단 머지), 데이터 6~93행.
- 시트 `결론` — 그룹별 등급분포·비율 요약(화면 재현 참고).
- 시트 `전체`(hidden), `논의 의견`은 이번 범위 제외.

### `평가자정리` 컬럼 레이아웃 (1-indexed, 4·5행 2단 헤더)
| 열 | 헤더 | 비고 |
|----|------|------|
| 2 | 성명 | 매칭 키(이메일 없음) |
| 3 | 4대보험 소속 | `에너지엑스㈜` 또는 `미래환경플랜` → legalEntity |
| 4 | 그룹 | 친환경기술그룹/엔지니어링그룹/건축설계그룹/경영그룹/이노베이션그룹 |
| 5 | 본부 | `-`=없음(그룹 직속) |
| 6 | 팀 | `-`=없음(본부 직속). 일부 앞뒤 공백/오타 존재(예: ` CS2본부 3팀`) |
| 7 | 직급 | 부대표/상무/이사/수석/책임/선임/프로 (position) |
| 8 | 직책 | 본부장/팀장/`-`/공백 (role 단서) |
| 9 | 그룹입사일자 | Excel serial(예 45505) 또는 텍스트("2023.12.30","2021-05-13") 혼재 → 정규화 필요 |
| 10 | 입사일자 | 〃 |
| 11·12 | 1차평가 실적·역량 | round1 |
| 13·14 | 2차평가 실적·역량 | round2 (`-`=미실시) |
| 15·16 | 최종평가 실적·역량 | final |
| 19 | 최종점수 | 일부 비어있음(공식셀) |
| 20 | 최종등급 | S/A/B/C/D — 일부 비어있음 |

> ⚠️ 실적/역량은 **각 라운드마다 두 점수**. 역량은 **참고용(연봉·최종등급 미반영)** — 보존만.
> ⚠️ `최종점수`/`최종등급`이 비어있는 행 다수 → 실적 점수로 등급 재계산 가능해야 함(2025 RuleSet 기준). 단 원본 등급이 있으면 원본 우선(임포트 신뢰).

## 2. 확정 결정 (사용자, 2026-06-05)

1. **역량평가 = 폐기 아님, 참고용 보존**. 연 1회(12월)·10문항·S/A/B/C/D, 가중치 100점 만점이나 **연봉/최종등급 미반영**. 시스템에 이미 `CompetencyQuestion`/`CompetencyResponse` 존재. 2025 임포트도 실적+역량 둘 다 저장하되 역량은 참고 데이터.
2. **퇴사자 = 비활성 User 보존**. 현재 조직도(seed v5, 117명)에 없는 사람 → `isActive=false`+`employmentStatus=퇴사` User 신규 생성(이메일 placeholder), 과거 결과 연결. 조직도엔 숨김, 비교 화면에서 "퇴사" 뱃지.
3. **미래환경플랜 = 법인 속성**. 별도 4대보험 소속이나 **조직도는 통합**(그룹→본부→팀 단일 트리). `User.legalEntity`로만 구분, 뱃지/필터 제공. 미래환경플랜은 여러 그룹(건축설계·친환경기술 등)에 걸침.
4. **연도=닫힌 사이클 아카이브**. 2025 = `EvaluationCycle(year=2025, status=closed)` + 자체 `RuleSet`(역량 포함). 규칙이 해마다 달라도 사이클별 RuleSet으로 버전 격리.
5. **결과에 당시 조직 스냅샷 저장**(그룹/본부/팀명). 조직개편이 있어도 *당시 기준* 비교.

## 3. 기능 범위 (6단계)

### S1. 스키마 보강 + 마이그레이션 (backend)
- `User.legalEntity` enum(`energyx`, `mirae_plan`), 기본 `energyx`.
- `User.employmentStatus` enum(`active`/`on_leave`/`resigned` ↔ 재직/휴직/퇴사), 기본 `active`. `resignedAt DateTime?`.
- `EvaluationResult`에 당시 조직 스냅샷: `groupSnapshot`/`divisionSnapshot`/`teamSnapshot` (String?), 또는 `orgSnapshot Json`. 더불어 역량 등 원형 점수는 기존 `byType` Json 활용(round1/round2/final × {perf, comp}).
- Prisma migration. 기존 데이터 무해(기본값).

### S2. 2025 사이클·RuleSet 시드 (backend)
- `EvaluationCycle(name:"2025년 정기평가", year:2025, cycleType:FINAL, status:closed)`.
- 전용 `RuleSet` — weightPolicy에 역량 포함(단 연봉 미반영 플래그), gradeScale은 2025 기준(원본 등급 우선이므로 보수적). 멱등 시드(재실행 안전).

### S3. 과거결과 임포트 (backend, ExcelService 확장)
- 새 임포트 모드: `평가자정리` 파서. 헤더 2단(4·5행) 처리.
- 날짜 정규화(Excel serial + 텍스트 혼재).
- **이름 매칭 3분기**:
  - 재직: 현재 User(이름)와 매칭 → 결과만 연결.
  - 퇴사: 매칭 실패 → `isActive=false`+`employmentStatus=resigned` User 생성(placeholder 이메일 `{slug}+resigned@import.local` 등), legalEntity·position·당시 조직 채움.
  - 동명이인: 이름 다중 매칭 → 그룹/본부 보조매칭. 그래도 모호하면 **검토큐**(미해결 행 리포트)로 빼고 관리자 확정.
- 검증 오류행 리포트(기존 import 리포트 패턴 재사용).
- 결과 적재: `EvaluationResult`(userId, cycleId=2025) + byType(실적·역량 원형) + 조직 스냅샷 + finalGrade/finalScore.

### S4. 연도 비교 API (backend)
- N개 사이클 누적 비교. 규칙 정규화 레이어(등급 S~D·100점 공통축).
- 개인 타임라인: `GET /api/v1/results/compare?userId=&cycleIds=` → 연도별 finalGrade/finalScore/실적·역량/당시조직 + 각 사이클 RuleSet 요약(규칙 차이 표면화).
- 조직 비교: `GET /api/v1/results/distribution?scope=group|division|team&...&cycleIds=` → 사이클별 등급분포(S~D 카운트·비율). `결론` 시트 재현.
- RBAC: 기존 visibilityScope 준수.

### S5. 비교 화면 (frontend)
- 개인 연도별 등급 추이 타임라인(스파크라인/스텝).
- 그룹·본부 등급분포 비교 차트(연도 나란히).
- 규칙차이 배너("2025는 역량평가 포함" 등).
- 퇴사자 뱃지, 법인별 보기 필터(에너지엑스㈜/미래환경플랜).
- 진입: 결과/대시보드 또는 신규 "연도 비교" 메뉴(hr_admin·division_head 중심).

### S6. 통합 QA — API↔프론트 정합성(응답 봉투·camelCase·훅 타입·라우팅·RBAC).

## 4. 제약 / 비범위
- 기존 2026 규칙·계산 로직 불변. 본 기능은 가산.
- 다른 _workspace 산출물 보존(가산 실행). 신규 문서: `02_contract/contract-yoy.md`, `01_design/wireframes-yoy.md`·`component-spec-yoy.md`, `05_qa/qa-report-yoy.md`.
