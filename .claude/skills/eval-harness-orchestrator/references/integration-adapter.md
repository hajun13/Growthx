# 외부 API 통합 규약 (소비 · 제공)

다른 서비스가 만든 API를 우리 것에 붙이고, 우리 API를 다른 서비스가 쓰게 하는 두 방향의 표준. 핵심 원칙은 **부패 방지(Anti-Corruption Layer)** — 외부 모델이 우리 도메인을 오염시키지 못하게 경계에서 번역한다. 계약 형식·발행은 `api-contract-convention.md`, 구조는 `architecture.md`가 담당하고, 이 문서는 **연동 경계의 패턴**을 정의한다.

## 1. 방향과 위치

| 방향 | 무엇 | 어디 |
|------|------|------|
| **소비 (consume)** | 타 팀/외부 서비스 API를 우리가 가져다 씀 | `apps/<svc>/src/modules/integration/<provider>/` 어댑터 |
| **제공 (provide)** | 우리 데이터를 다른 서비스가 가져다 씀 | 우리 API에 외부용 엔드포인트 + 발행 OpenAPI + 키 인증 |

두 방향 모두 **OpenAPI가 계약**이다. 손으로 타입을 베끼지 않고 codegen으로 동기화한다.

## 2. 소비 — 부패 방지 어댑터

외부 API는 언제든 바뀌고, 그들의 필드명·에러·구조는 우리 관례(camelCase·`{data}` 봉투·도메인 용어)와 다르다. **어댑터가 유일한 접점**이 되어 외부 모델을 우리 도메인 타입으로 번역한다. 외부가 흔들려도 코어는 불변.

```
modules/integration/<provider>/
├── README.md                      # 매니페스트: 어떤 외부 API·인증·번역 대상
├── <provider>.client.ts           # codegen된 클라이언트 래퍼 (외부 OpenAPI 기반)
├── <provider>.adapter.ts          # ★ 부패 방지: 외부 응답 → 우리 도메인 타입
├── <provider>.types.ts            # 외부 raw 타입 (codegen, 우리 도메인과 격리)
└── __tests__/
```

**규칙:**
- 외부 OpenAPI 스펙을 `packages/contracts/external/<provider>.yaml`에 두고 codegen → `<provider>.types.ts`·client 생성. 외부 raw 타입은 **어댑터 밖으로 새지 않는다**(서비스·컨트롤러는 우리 도메인 타입만 본다).
- 어댑터가 **번역**한다: 외부 필드 → 우리 camelCase 도메인 필드, 외부 에러 → 우리 `{error}` 봉투/예외, 단위·열거값 정규화.
- **회복탄력성을 경계에 둔다:** 타임아웃·재시도(지수 백오프)·서킷 브레이커·폴백을 어댑터에서 처리. 외부 장애가 우리 요청 스레드를 무한 대기시키지 않게.
- **비밀·엔드포인트는 환경변수.** `<PROVIDER>_BASE_URL`·`<PROVIDER>_API_KEY`를 `.env`로, 코드에 하드코딩 금지. `.env.example`에 키 이름만 등재.
- **계약 드리프트 감지:** 외부 OpenAPI를 버전 고정(파일로 커밋)하고, 갱신 시 codegen 재실행 → 타입 컴파일 에러로 깨진 곳이 드러나게.

## 3. 제공 — 외부 소비자용 API

우리 평가 데이터를 다른 서비스가 가져다 쓰게 한다.

- **계약 = 발행된 OpenAPI.** `@nestjs/swagger`가 만든 `openapi.json`을 버저닝(`/api/v1`)해 공개. 소비자는 이걸 codegen해서 쓴다.
- **인증은 키/토큰.** 사람용(JWT Bearer)과 별개로, 서비스 간 호출은 **API 키** 또는 **클라이언트 자격증명(OAuth2 client credentials)** 으로. 키별 스코프(읽기 전용 등)를 RBAC로 강제.
- **버전 호환:** 공개 엔드포인트는 깨는 변경(필드 제거·의미 변경)을 금지. 바꿔야 하면 `/api/v2`로 새 버전을 내고 구버전을 유예기간 동안 유지.
- **레이트 리밋·감사:** 외부 소비자별 호출량 제한 + 호출 로그(`AuditLog`)로 추적.
- **노출 범위 최소화:** 내부 전용 필드/엔드포인트를 외부 OpenAPI에 노출하지 않는다(Swagger 태그/그룹으로 public/internal 분리).

## 4. 공유 도메인은 패키지로, 연동은 HTTP로

같은 모노레포 안의 두 앱이 같은 개념(인증·사용자·조직)을 쓴다면:

- **공유 개념 = `packages/` 패키지.** 라이브러리로 import(`@energyx/auth`). 네트워크 호출 아님 — 같은 프로세스에서 코드 공유.
- **서비스 고유 데이터 = HTTP + OpenAPI.** 앱 B가 앱 A의 평가 결과가 필요하면 A의 공개 API를 호출(앱이 앱을 직접 import하지 않는다 — `architecture.md` §1).

이 구분이 "무엇을 패키지로, 무엇을 API로" 의 판단 기준이다: **공통 규칙/타입/UI는 패키지, 서비스가 소유한 런타임 데이터는 API.**

## 5. 통합 작업 체크리스트

새 외부 연동을 붙일 때:

1. 방향 판별(§1) — 소비/제공.
2. 소비면: 외부 OpenAPI를 `packages/contracts/external/`에 고정 → codegen → `integration/<provider>/` 어댑터 작성(§2). 회복탄력성·비밀 환경변수.
3. 제공이면: 외부용 엔드포인트 + Swagger 그룹 분리 + 키 인증·스코프·레이트리밋(§3).
4. 어댑터/엔드포인트에 매니페스트 README + 테스트.
5. 계약(외부 스펙 또는 우리 발행 스펙)을 커밋해 드리프트를 컴파일타임에 잡는다.
