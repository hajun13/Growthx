# 인사평가 솔루션 — M3 Items 1-3 + 조직도 (온보딩·RBAC 고도화·KPI 카테고리 제한·조직도)

> 리더 확정 · 2026-06-04 · **이 문서는 M3 Items 1-3 + 조직도 범위에서 기존 SSOT(domain-model·business-rules)보다 우선**(충돌 시 본 문서).
> **병렬 스트림 주의:** `requirements-m3.md`의 **Items 4-10(월별 실적·대시보드 고도화·연봉 시뮬·평가결과 PDF·매출 KPI 구조 등)은 별도 에이전트 담당** — 그 모듈(monthly-performance·dashboard trend·compensation simulation·results export PDF 등)은 **건드리지 않는다.** 본 스트림은 Items 1-3 + 조직도만.
> **스키마 공유 규칙:** 본 스트림이 User에 `mustChangePassword`·`position`·`visibilityScope` 등을 추가한다(다른 스트림이 이를 읽고 위에 얹음). schema.prisma 수정 전 최신 Read, 기존/타 스트림 추가분 보존, 신규 모델은 파일 끝에 추가.
> 사용자 결정: ①실 117명 명부로 **교체**(데모 평가 데이터 폐기, 조직/인원만 새로) ②RBAC = **직급 자동기본 + 관리자 수동 오버라이드**.

## 0. 권위 입력 — 실 임직원 명부
`C:\Users\user\Downloads\에너지엑스_임직원명부(조직도연동).xlsx` (시트 "임직원 명부").
- **컬럼:** `그룹 | 본부 | 팀 | 직급 | 이름 | 이메일` (6열, 117명, 이메일 중복 0).
- 본부/팀은 **빈 값 가능**(팀이 그룹 직속, 대표이사는 소속 없음).
- 직급 분포: 대표이사 6·부대표 1·상무 2·이사 1·수석 2·본부장 10·팀장 1·책임 31·선임 33·프로 30.
- 그룹 5: 이노베이션·건축설계·엔지니어링·친환경기술·경영. 본부 10·팀 24.
- 이 포맷이 임포트의 단일 기준(Amaris 인사 시스템 다운로드 시트 = 위 6컬럼).

## 1. 직급(position) enum 확장
신규 enum `Position`: `ceo(대표이사) · vice_president(부대표) · executive(상무) · director(이사) · principal(수석) · division_head(본부장) · team_lead(팀장) · chief(책임) · senior(선임) · pro(프로)`.
- 한글 라벨 매핑(UI). 기존 jobLevel(KPI 양식용)은 별개 유지 + position→jobLevel 파생 매핑.

## 2. 조직 (group→division→team, division nullable)
- Department.type = group/division/team 유지. **division 없이 team이 group 직속 가능**.
- 조직도 표시용 회사 루트 라벨(에너지엑스 주식회사)은 표시 레벨에서만(스키마 강제 아님).
- 노드별 인원 카운트(하위 포함/직속) 집계.

## 3. 기능 A — 엑셀 일괄 온보딩 + 초기 비밀번호 (Item 1)
### A-1 명부 임포트 (`POST /excel/import/roster`, hr_admin)
- 위 6컬럼 .xlsx → 조직 트리(그룹/본부/팀) upsert + 사용자 117명 upsert(이메일 기준).
- 각 사용자: position·name·email·deptId(팀>본부>그룹 최하위)·**초기 비밀번호 `1234` 해시**·`mustChangePassword=true`·role/visibilityScope 자동기본(§4).
- 검증·오류행 `{validCount,errorCount,errors:[{row,message}]}`. 멱등(재업로드 중복 없이 갱신).
- 양식 다운로드 `GET /excel/template/roster`(6컬럼).
### A-2 초기 비밀번호 강제 변경 (Item 1)
- User에 `mustChangePassword: boolean`. 로그인 응답에 플래그 포함.
- `POST /auth/change-password`(현재 비번 확인 → 신규, 정책: 최소 길이·`1234` 금지). 변경 시 `mustChangePassword=false`.
- 프론트: `mustChangePassword=true`면 **모든 화면 진입 전 비밀번호 변경 강제**. 백엔드도 change-password·logout·me 외 차단 가드.

## 4. 기능 B — RBAC 가시성 고도화 (Item 2, 직급 자동기본 + 수동 오버라이드)
- User에 **`visibilityScope`** enum: `self · team · division · group · company`.
- **자동기본(임포트 시):**
  - 인사총무팀(인사/HR 명칭 팀) 소속 → role=hr_admin, scope=company.
  - ceo/vice_president/executive/director → role=division_head, scope=group(본인 그룹 전체).
  - 본부장(division_head) → role=division_head, scope=division(**본인 본부만** — 형제 본부 불가, 경쟁 구조).
  - 팀장(team_lead) → role=team_lead, scope=team(본인 팀만).
  - principal·chief·senior·pro → role=employee, scope=self(본인만).
- **수동 오버라이드:** 관리자가 조직도에서 사람별 role·visibilityScope 변경.
- **가드 변경:** 기존 자동 트리 파생(canViewUser) → **visibilityScope 기준** 가시 범위 산정. self/team/division(형제 제외)/group/company. 전 조회(평가·결과·KPI·이의·대시보드·조직도) 일관 적용, 행수준 강제 백엔드 단일.

## 5. 기능 C — KPI 카테고리 직급 제한 (Item 3, 비직책자 제어)
- position별 허용 KpiCategory 집합. 자동기본:
  - 직책자(ceo·vice_president·executive·director·division_head·team_lead) → 전 카테고리.
  - 비직책자(principal·chief·senior·pro) → **revenue(매출액)·orders(수주&영업) 차단**, construction·collaboration·development 허용.
- **관리자 설정:** position×category 허용/차단 매트릭스 편집(설정 화면). 별도 `KpiCategoryPolicy` 모델(또는 RuleSet 확장).
- **강제:** KPI 작성/제출 시 백엔드가 허용 외 카테고리 거부(422 CATEGORY_NOT_ALLOWED). 프론트는 사용자 position에 맞게 카테고리 선택지 필터.
> 주의: 별도 스트림 Item 10(매출 KPI를 그룹목표 읽기전용 구조로)과 겹칠 수 있음 — 본 스트림은 **카테고리 접근 제어(권한)만** 담당, 매출 KPI의 그룹목표 구조화는 그쪽. 카테고리 enforcement 지점은 공유 가능하도록 깔끔히.

## 6. 기능 D — 조직도 화면 (사용자 제공 스크린샷 기준)
- **좌측 트리:** 회사(루트) > 그룹 > 본부 > 팀, 노드별 인원 수 배지, 펼침/접힘, 검색·필터.
- **우측 인물 카드 그리드:** 선택 노드 인원 — 사진(placeholder)·이름·직급·소속 경로·이메일·연락처. 카드/리스트 뷰 토글.
- **CRUD (hr_admin):** 사람 추가(소속·직급·이메일 → 초기비번1234·mustChangePassword) · 수정(이름·직급·소속 이동·role·visibilityScope) · 삭제/비활성. 조직 노드 추가/이름변경/이동(여력 시).
- 권한: hr_admin 편집, 그 외 가시 범위 내 열람.
- 엔드포인트: `GET /org-chart`(트리+카운트), `GET /users?deptId=`, `POST/PATCH/DELETE /users`, (옵션) 조직 노드 CRUD.

## 7. 데이터 교체 (사용자 결정)
- seed/임포트로 **실 117명·실 조직 교체**. 데모 평가 주기/결과/보상/감사는 폐기. 평가 도메인 **코드는 유지**(데이터만 신규 조직 기준).
- 검증/접속용 인사총무팀 1명을 hr_admin 데모 계정으로 안내(초기 비번 1234 → 첫 로그인 변경 흐름 시연).

## 8. 비기능·검증
- 응답 봉투·camelCase·계약우선. 신규 엔드포인트 계약(`02_contract/contract.md`) **M3 델타** 추가(타 스트림과 같은 파일 공유 — 충돌 안 나게 별도 소절 "M3-Items1-3").
- 전역 RBAC + visibilityScope 가드 + password 강제변경 가드. Prisma 변경 → `migrate dev`로 M3 마이그레이션 생성(이력화 체계 유지).
- Node v24·Docker 검증: **실제 xlsx 117명 임포트 실행** → 117 사용자·조직 트리·비번1234·첫로그인 강제·scope 가드·KPI 카테고리 차단·조직도 화면 동작 확인.

## 9. 산출물
- 계약 `_workspace/02_contract/contract.md`(M3-Items1-3 소절) · BE `apps/api`(신규: onboarding/roster import·org-chart·auth change-password; 확장: users·departments·kpis·auth·excel·guards·prisma) · FE `apps/web`(라우트: /org·비번변경·설정 KPI카테고리/가시성) · 디자인 `_workspace/01_design/*-m3.md`(별도 스트림과 파일명 안 겹치게 `-items1-3` 접미) · QA `_workspace/05_qa/qa-report-m3-items1-3.md` · 릴리스 RELEASE.md(M3).
