# 02 — 본인평가(self) 제출

**Seed:** e2e/tests/seed.spec.ts
**전제:** 멱등 시드(seed-test-data.ts) 적용 상태. 테스트 계정(test@energyx.co.kr)의 KPI 4건이 `confirmed`, 본인평가는 미제출(`not_started`/`in_progress`).
**Starting state:** test@energyx.co.kr (hr_admin) 인증됨.

---

## Happy Path: 본인평가 시작 → 전 과제 입력 → 제출

### Steps
1. `page.goto('/eval/self')`.
2. 페이지 제목 "본인평가" visible.
3. (미시작 시) "본인평가 시작하기" 버튼 클릭 → 폼 렌더.
4. "성과중심 지표" / "협업·성장 지표" 섹션과 KPI 카드 4개 렌더.
5. 과제별 GradeCriteriaPicker(S/A/B/C/D)에서 등급 선택(예: B/A/C/B) → 등급 배지 표시.
6. 정성 과제 메모 textarea 입력.
7. 하단 진행 바 "4/4건 완료 · 100%" + "미입력 0" 확인.
8. "임시저장" → 입력 유지.
9. "제출하기"(활성) 클릭 → 확인 모달 "본인평가를 제출할까요?" → "제출".
10. 성공 토스트 "본인평가를 제출했어요.".

### 제출 후
11. "제출 완료" 배지 + 읽기전용 배너 visible.
12. 하단 바(임시저장/제출) 사라짐, 입력 필드/피커 disabled.

**Success:** 제출 후 읽기전용 배너·비활성 필드. **Failure:** 오류 토스트, 제출 후에도 입력 활성.

---

## Negative: 미완료 과제 있을 때 제출 차단
1. `in_progress` 상태, 4개 중 일부만 등급 입력.
2. "제출하기" 비활성, "아직 N개 과제를 입력하지 않았어요." 경고 visible.
3. 비활성 버튼 클릭 시 모달 안 열림.

## Negative: 이미 제출된 평가 재제출 차단
1. `submitted` 상태에서 `/eval/self`.
2. 읽기전용 배너 visible, 제출/임시저장 버튼 없음, 피커 disabled.

## Edge: KPI 미확정 사용자
1. KPI가 `confirmed` 아님 → "KPI가 확정되면 본인평가를 입력할 수 있어요." + "/kpi" 링크.

## Edge: 증빙 첨부 UI
1. KPI 카드에 "파일 첨부" 버튼·"문서·이미지·압축 파일, 1개당 10MB 이하" 안내 visible (업로드 트리거는 hidden input — UI visible만 검증).
