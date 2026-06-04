# 요구사항 M3 — 회의 녹취록 기반 신규 기능 (Items 4-10)

> 출처: 향기로 2.doc (내부 회의 녹취록, 2026-06-04)
> 작성: orchestrator
> 주의: Items 1-3(엑셀 임직원 일괄등록·초기비밀번호 강제변경·비직책자 KPI제한)은 별도 에이전트 진행 중. 본 문서는 Items 4-10 전용.
> 스키마 충돌 방지: schema.prisma 수정 전 반드시 최신 상태 Read 확인 후 추가.

---

## Item 4 — 월별 실적 데이터 입력

### 배경
- 그룹/본부 목표(매출액·공정액 등)는 연초에 경영진→그룹→본부 캐스케이드로 확정
- 매월 실적을 본부장 또는 지정 담당자가 직접 입력 → 누적 달성률 자동 계산 → 현재 등급 표시
- 입력 주기: 월 1회(분기 보고와 연동). 실시간 아님.

### 기능 요구사항
1. **월별 실적 입력 UI (관리자/본부장)**: 그룹·본부별 1월~12월 실적값을 테이블 형태로 입력
2. **누적 달성률 자동 계산**: 입력된 월별 실적 합계 / 연간 목표 → 달성률 → Grade 자동 매핑
3. **현재 등급 대시보드 표시**: S/A/B/C/D 실시간 반영(월 1회 갱신 기준)
4. **권한**: hr_admin 전체 입력, division_head 본인 본부만, team_lead 조회만

### 데이터 모델 (신규)
```
MonthlyPerformance {
  id, cycleId, departmentId(group/division), year, month(1-12),
  targetAmount(Float), actualAmount(Float), category(KpiCategory),
  enteredById, createdAt, updatedAt
}
```
- 기존 `GroupPerformance`와 구분: GroupPerformance는 전체 그룹 집계, MonthlyPerformance는 월별 세부 입력

### API 신규 엔드포인트
- `GET /api/v1/monthly-performance?cycleId=&departmentId=&year=` — 월별 실적 목록
- `POST /api/v1/monthly-performance` — 월별 실적 입력
- `PATCH /api/v1/monthly-performance/:id` — 수정
- `GET /api/v1/monthly-performance/summary?cycleId=&departmentId=` — 누적 달성률 + 현재 등급

---

## Item 5 — 평가 기간 잠금/열기

### 배경
- KPI는 설정 기간 외에는 수정 불가(잠금 상태)
- 3개 주요 기간: ①KPI 설정(1~2월) ②중간 평가(6월, 재오픈·수정 가능) ③최종 평가(12월)
- HR 관리자가 기간별 열기/닫기를 수동 제어

### 기능 요구사항
1. **기간 관리 UI (admin)**: 각 phase의 시작일·마감일·잠금여부 설정
2. **잠금 강제**: 잠금 기간에는 KPI 작성/수정 API가 403 반환
3. **현재 기간 표시**: 임직원 화면에 "현재 KPI 작성 기간: [기간명] (~마감일)" 배너

### 스키마 변경
- 기존 `CycleSchedule`에 `isLocked Boolean @default(false)` 필드 추가
- `CycleStatus`에 `locked` 추가하거나 phase별 isLocked로 제어

### API 변경
- `PATCH /api/v1/cycles/:id/schedules/:phase` — `isLocked` 토글
- `GET /api/v1/cycles/:id/current-phase` — 현재 활성 phase + isLocked 상태 반환
- KPI 생성/수정 API: 현재 phase isLocked 체크 → 잠금 시 `423 LOCKED` 에러

---

## Item 6 — 역량 평가 문항 관리

### 배경 (회의록 근거)
- 성과 평가(KPI, 연 2회)와 별도로 역량 평가(연 1회 12월)가 존재
- 역량 평가: 약 10개 질문, S/A/B/C/D 등급 응답
- **연봉 산정에 미반영** — 참고 데이터로만 보관
- 질문지는 HR 관리자가 설정, 임직원은 응답만 가능

### 기능 요구사항
1. **질문 관리 UI (hr_admin)**: 역량 평가 질문 CRUD
2. **역량 평가 응답 UI (employee)**: 설정된 질문에 S/A/B/C/D 선택 + 코멘트
3. **결과 조회 (관리자)**: 팀/본부별 역량 평가 결과 집계
4. **연봉 비연동 명시**: 평가 화면에 "본 평가는 연봉에 반영되지 않습니다" 안내

### 데이터 모델 (신규)
```
CompetencyQuestion {
  id, cycleId, order(Int), text, hint(String?),
  isActive Boolean @default(true),
  createdById, createdAt, updatedAt
}

CompetencyResponse {
  id, questionId, userId, cycleId,
  grade(Grade), comment(String?),
  submittedAt(DateTime?), createdAt, updatedAt
  @@unique([questionId, userId, cycleId])
}
```

### API 신규 엔드포인트
- `GET /api/v1/competency-questions?cycleId=` — 질문 목록
- `POST /api/v1/competency-questions` — 질문 생성 (hr_admin)
- `PATCH /api/v1/competency-questions/:id` — 질문 수정 (hr_admin)
- `DELETE /api/v1/competency-questions/:id` — 질문 삭제 (hr_admin)
- `GET /api/v1/competency-responses?cycleId=&userId=` — 응답 목록
- `POST /api/v1/competency-responses/bulk` — 일괄 응답 제출 (employee)
- `GET /api/v1/competency-responses/summary?cycleId=&departmentId=` — 집계 (관리자)

---

## Item 7 — 대시보드 고도화

### 배경
- 현재 대시보드는 기본 통계만 표시
- 필요: 그룹/팀 목표 달성 현황 카드, 등급 분포, 월별 트렌드

### 기능 요구사항
1. **그룹 등급 카드**: 각 그룹의 현재 누적 달성률 → 현재 등급 표시 (S/A/B/C/D + 퍼센트)
2. **팀 목표 달성 카드**: "우리 팀 목표 10억 → 현재 6억 (60%)" 형태
3. **등급 분포**: 그룹 내 S/A/B/C/D 인원 분포 (막대 차트)
4. **가시성 규칙**:
   - 일반 임직원: 본인 그룹 등급 + 본인 달성률만
   - 팀장: 팀 전체 달성률
   - 본부장: 본부 전체 + 하위 팀 달성률
   - 관리자: 전체 그룹 현황
5. **기존 dashboard API** (`GET /api/v1/dashboard/summary`) 응답에 `groupGrades[]`, `monthlyTrend[]` 추가

### API 변경
- `GET /api/v1/dashboard/summary` 응답 확장:
  - `groupGrades: [{groupId, groupName, currentGrade, achievementRate, targetAmount, actualAmount}]`
  - `teamGoal: {targetAmount, actualAmount, achievementRate, currentGrade}` (팀장 전용)
  - `gradeDistribution: [{grade, count}]` (관리자/본부장)
  - `monthlyTrend: [{month, achievementRate, grade}]`

---

## Item 8 — 연봉 시뮬레이션

### 배경
- 현재 등급 기준으로 내년 연봉 예상값 자동 계산
- S등급 = +7%, A등급 = +5%, B등급 = +3% 등 (RuleSet 기반)
- 본인은 자기 것만, 관리자는 팀원 전체 가능

### 기능 요구사항
1. **개인 연봉 시뮬레이션 카드**: 현재 연봉 → 현재 등급 → 예상 인상률 → 예상 내년 연봉
2. **팀 연봉 영향 테이블 (관리자용)**: 팀원별 현재 연봉·등급·예상 인상·예상 연봉 테이블
3. **등급별 시뮬레이션**: "등급이 S면 얼마, A면 얼마" 비교 슬라이더

### 스키마 변경
- `User`에 `currentSalary Float?` 필드 추가 (hr_admin만 입력)
- 기존 `Compensation` 모델 활용 (simulated=true 행이 시뮬레이션 결과)

### API 변경
- `GET /api/v1/compensations/simulation?cycleId=&userId=` — 개인 시뮬레이션
- `GET /api/v1/compensations/simulation/team?cycleId=&departmentId=` — 팀 전체 시뮬레이션 (관리자)
- `PATCH /api/v1/users/:id/salary` — 현재 연봉 입력 (hr_admin)

---

## Item 9 — 평가 결과 출력/다운로드

### 배경
- 임직원이 평가 결과를 PDF 또는 Excel로 다운로드
- 내용: 본인 KPI 목록 + 본인 자기평가 + 팀장평가 + 본부장평가 + 최종 등급

### 기능 요구사항
1. **개인 평가 결과 다운로드 버튼** (eval/result 페이지): PDF + Excel 선택
2. **관리자 전체 다운로드** (admin 페이지): 전체 임직원 평가 결과 Excel 일괄 다운로드
3. **다운로드 내용**:
   - 기본 정보: 이름, 부서, 직책, 평가 주기
   - KPI 목록 + 각 KPI별 자기평가/팀장평가/본부장평가 점수·등급·코멘트
   - 최종 종합 등급
   - 역량 평가 결과 (별도 시트, 연봉 미반영 명시)

### API 변경
- 기존 `GET /api/v1/excel/export?kind=evaluations` 확장
- `GET /api/v1/results/:userId/export?cycleId=&format=pdf|excel` — 개인 평가 결과 파일 다운로드
- PDF 생성: `@react-pdf/renderer` 또는 서버사이드 HTML→PDF (puppeteer 불필요, 간단 레이아웃)

---

## Item 10 — 매출액 KPI 구조 정립

### 배경
- 매출액은 경영진이 연초에 확정 → 그룹→본부로 캐스케이드 (개인이 선택하는 항목 아님)
- 현재 문제: 일반 임직원이 매출액 KPI를 자유 작성 → 데이터 오염
- 올바른 구조: 매출액은 GroupPerformance의 고정 목표값으로 관리, 개인 KPI는 건수(count) 기반

### 기능 요구사항
1. **KPI 생성 시 category=revenue 제한**: hr_admin, division_head, team_lead만 생성 가능
2. **개인 KPI에 매출액 카테고리 표시 방식 변경**: 선택 항목 아닌 "그룹 목표" 읽기 전용 섹션으로 표시
3. **그룹 목표 읽기 전용 표시**: KPI 작성 화면 상단에 "소속 그룹 매출 목표: 10억" 표시 (MonthlyPerformance 또는 GroupPerformance에서 조회)
4. **달성률 자동 연동**: GroupPerformance 달성률이 개인 평가 등급에 영향 (기존 business-rules의 캐스케이드 로직 활용)

### API 변경
- KPI 생성 API에 category=revenue/construction/orders 작성 권한 체크 강화
- `GET /api/v1/group-performance/my-group?cycleId=` — 본인 소속 그룹의 목표/실적 조회 (개인용)

---

## 공통 구현 지침

### 디자인
- Apple 디자인 언어 (`DESIGN.md` 참조): Action Blue #0066cc, 잉크 #1d1d1f, pill 버튼, 라운드 8/11/18
- 글꼴: Pretendard 유지
- 기존 shadcn/ui 컴포넌트 최대 활용

### 스키마 충돌 방지
- 작업 시작 전 `apps/api/prisma/schema.prisma` Read로 최신 상태 확인
- Items 1-3 에이전트가 User 모델에 `mustChangePassword`, `isFirstLogin` 등을 추가했을 수 있음 → 덮어쓰지 말 것
- 신규 모델만 파일 끝에 추가

### 타입 안전
- 모든 신규 API는 `_workspace/02_contract/contract.md`의 M3 델타 섹션에 추가
- 프론트 타입은 `apps/web/lib/types.ts`에 추가
- 기존 타입 수정 시 nullable 필드 주의 (B-1 QA 결함 반영)
