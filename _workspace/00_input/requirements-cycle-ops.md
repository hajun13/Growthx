# 요구사항 — 평가 운영 단계 모델 개편 (Cycle Ops)

**요청일:** 2026-06-05 · **요청자:** hgai@energyx.co.kr · **모드:** 부분 재실행

## 배경 / 운영 흐름
평가 운영을 **KPI 라이프사이클(선정→잠금→재오픈→잠금→최종)** 타임라인으로 재정의한다.

- **1~3월: KPI 1차 선정·작성** — 열림(수정 가능)
- **4/1~6/9: 상반기 실행관리** — **잠금**(1차 확정 후 수정 불가)
- **6/10~6/30: 중간평가(재오픈)** — 열림(목표·KPI 변경 허용)
- **7/1~11/30: 하반기 성과관리** — **잠금**(다시 수정 불가)
- **12월: 최종평가** — 열림(등급 확정·보상)

## 범위 (4개 작업)
1. **단계 모델 확장** — KPI 라이프사이클 중심 phase 키 추가(`kpi_selection`/`execution_h1`/`mid_review`/`execution_h2`/`final_review`). 기존 키(prep/self/downward1/downward2/result) 라벨은 하위호환 유지.
2. **prep/preparation 불일치 버그 수정** — UI `DEFAULT_PHASES`(`prep`) ↔ seed(`preparation`) 불일치로 고아 레코드 발생. 정규 키로 통일.
3. **재오픈 사유 필수 + 감사로그** — 잠금 해제(재오픈) 시 사유 필수 입력, `AuditLog`에 사유 기록.
4. **임직원 배너 다음 열림 시점** — 잠금 기간 중 "다음 수정 가능: {시점}" 안내.
5. **1차 확정 KPI 스냅샷 + diff UX** — 1차 확정 시점 KPI 스냅샷 → 재오픈 변경분 diff(추가/삭제/변경 필드) 조회.

## 핵심 메커니즘 (기존)
- `CycleSchedule(phase, startDate, dueDate, isLocked)` — 단계별 잠금.
- `CycleLockService.assertKpiWritable()` — 오늘 날짜가 활성 윈도우에 든 단계 중 하나라도 잠겨 있으면 KPI 작성·수정 423 차단. **빈 구간 = 자동 열림** → 잠금 기간을 빈틈없이 덮어야 함.

## 불변식
- 응답 봉투 `{data}` / `{data,meta}` / `{error}` 유지.
- 잠금은 KPI 작성·수정에만 적용(평가 제출 비차단).
- 단계 윈도우는 겹치지 않게(앞 dueDate < 다음 startDate). 겹치면 `some(isLocked)`로 통째 차단됨.
