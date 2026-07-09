# KPI 엑셀 파싱 DeepSeek AI 폴백 — 설계

- 날짜: 2026-07-09
- 상태: 승인됨 (설계 단계)
- 범위: `apps/api` KPI 일괄 등록(개인별 KPI 양식) 파싱에 DeepSeek LLM 기반 폴백 추가

## 배경 / 문제

개인별 KPI 엑셀 양식이 부서·연차·팀마다 제각각이라, 헤더 텍스트 동적 매핑 + 분류 사다리를
갖춘 결정론적 파서(`ExcelService.parseKpiSheet`)조차 다음 두 지점에서 깨진다.

1. **헤더/열 탐지 실패** — 양식이 표준에서 크게 벗어나 `detectKpiColumns` 가 열을 못 찾음 → 0행.
2. **분류 인식 실패** — 열은 찾았지만 자유 서술 핵심전략을 표준 매핑·CSF/스템 폴백으로도 분류 못함 → `valid=false` 행.

두 실패 모드를 DeepSeek LLM 으로 구제하되, 검증된 결정론적 파서는 그대로 살린다.

## 결정 사항 (브레인스토밍 확정)

| # | 질문 | 결정 |
|---|------|------|
| Q1 | AI 위치 | **폴백** — 파서 먼저, 실패·저신뢰에서만 AI |
| Q2 | 전송 데이터 | **셀 텍스트만** — 이름·식별정보 제거 |
| Q3 | 키·설정 | **환경변수** — 키 없으면 AI 자동 비활성 |
| Q4 | 촉발 조건 | **둘 다** — 헤더 실패→시트 단위, 분류 실패→행 단위 |
| Q5 | 신뢰·표시 | **플래그+경고** — `source:'ai'` 배지, 저신뢰/가중치 이상 행만 `valid=false` |

## 아키텍처 — 부패방지 어댑터

DeepSeek 는 외부 API 이므로 `ExcelService` 가 HTTP 세부에 직접 의존하지 않도록 어댑터로 격리한다.

```
apps/api/src/modules/integration/deepseek/
  ├── deepseek.client.ts     # 얇은 HTTP 클라이언트 (OpenAI 호환 POST /chat/completions)
  │                          #   env 설정 · 타임아웃 · 1회 재시도 · response_format JSON
  ├── kpi-parse.agent.ts     # 에이전트: 프롬프트 구성 + 응답 JSON → KPI 행 변환
  │                          #   classifyRows(unresolved) · extractSheet(grid)
  └── deepseek.module.ts     # KpiParseAgent · DeepseekClient provider/export
```

- `ExcelModule` 이 `DeepseekModule` 을 import, `ExcelService` 가 `KpiParseAgent` 를 주입.
- 키 미설정 → `agent.isEnabled() === false` → AI 경로 전체 스킵(기존 파서만).
- 각 파일 ~200줄 상한(architecture.md) 준수 — 클라이언트/에이전트/프롬프트 분리.

### DeepSeek API 계약 (소비)

- Base: `https://api.deepseek.com` (env override)
- Endpoint: `POST /chat/completions` (OpenAI 호환)
- Model: `deepseek-chat` (env override)
- `response_format: { type: 'json_object' }` 로 JSON 강제
- Auth: `Authorization: Bearer $DEEPSEEK_API_KEY`

## 파이프라인

`parseKpiSheet` (순수·동기, 그대로 유지 — 테스트 가능) 위에 async 증강 래퍼 `parseKpiSheetWithAi` 신설.

1. 결정론적 파서 실행.
2. 헤더 탐지 실패(det null / rows 0) → `agent.extractSheet(cellGrid)` → rows 생성, 각 행 `source:'ai'`.
3. 열 탐지 성공 + 분류 인식 실패 행(`valid=false` & 미인식 카테고리) → 해당 행 텍스트만 모아 `agent.classifyRows()` → category/group/isQualitative 보완, `source:'ai'`.
4. `previewKpi` · `importKpi` 가 이 래퍼 사용. `commitKpi` 는 이미 관리자 편집된 rows 라 AI 미적용.

`parseKpiSheet` 반환은 동기 유지, AI 는 async 래퍼에서만 — 순수 파서의 테스트 용이성·회귀 안전성 보존.

## 전송 데이터 (개인정보 최소화)

- **전송**: 깨진 시트의 셀 텍스트 — 핵심전략 · KPI명 · 목표 · 측정방식 · 등급기준(S~D) · 가중치.
- **미전송**: 파일명/시트명의 사람 이름, userId, 연봉, 조직 식별정보. 프롬프트에 애초에 포함 안 함.
- 프롬프트에 KPI 택소노미(5 `KpiCategory` · 2 `KpiGroup` enum + 한글 라벨)를 주어 AI 가 enum 값으로 반환.

## 신뢰 · 표시

- AI 행: `valid=true` + `source:'ai'` + `warnings[]` 고지("AI 가 분류를 추론했어요 — 확인해 주세요").
- 예외로 `valid=false` 강등: ①AI 가 `confidence:'low'` 로 표시 ②가중치 합이 100%를 크게 벗어난 행.
- `KpiImportRowDto` 에 `source: 'parser' | 'ai'` 필드 추가 → OpenAPI 재발행 → `packages/contracts` orval 재생성.
- 기존 `previewKpi`/`importKpi`/`commitKpi` 응답 shape 은 필드 추가 외 불변(하위 호환).

## 회복탄력성

- env: `DEEPSEEK_API_KEY`(없으면 비활성), `DEEPSEEK_BASE_URL`(기본 `https://api.deepseek.com`),
  `DEEPSEEK_MODEL`(기본 `deepseek-chat`), `DEEPSEEK_TIMEOUT_MS`(기본 30000).
- 타임아웃 + 1회 재시도. 실패 시 예외를 삼키고 **파서 결과만 반환** + warning("AI 보완에 실패했어요 — 파서 결과만 표시").
- 외부 장애가 KPI 임포트를 절대 차단하지 않는다(integration-adapter.md §2 회복탄력성).
- `.env.example` · docker-compose 환경변수 템플릿 갱신.

## 프론트엔드 (최소)

- `apps/web` `AdminKpiImportView`: `source:'ai'` 행에 "AI 추론" 배지. warnings 배너는 기존 재사용.

## 테스트

- 어댑터 단위 테스트: DeepSeek 응답 **목킹**(실제 네트워크 호출 없음) — classifyRows·extractSheet JSON 파싱·에러 폴백.
- 회귀 안전판: 키 비활성(`isEnabled()===false`) 시 `parseKpiSheetWithAi` 출력이 기존 `parseKpiSheet` 와 동일.
- 통합: 실제 깨진 양식 파일(친환경기술그룹 계열 등) 있으면 preview 엔드포인트로 확인.
- api·web `tsc` 0, `build` 통과.

## 범위 밖

- 경영실적(financial-performance)·명부(roster)·과거결과(legacy-results) 임포트 — 이번 범위 아님.
- 관리자 화면 키 입력(DB 저장) — env 로 대체.
- 온프렘/self-host 모델 — DeepSeek API 사용 확정.

## 파일 영향 요약

- 신규: `apps/api/src/modules/integration/deepseek/{deepseek.client,kpi-parse.agent,deepseek.module}.ts`
- 수정: `apps/api/src/modules/excel/excel.service.ts`(래퍼·주입), `excel.module.ts`(import),
  `dto/kpi-import-response.dto.ts`(`source` 필드), `packages/contracts`(재생성),
  `apps/web` `AdminKpiImportView`(배지), `.env.example`·`docker-compose`(env), `apps/api` 테스트.
