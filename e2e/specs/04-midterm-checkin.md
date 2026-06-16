# 04 — 중간점검 자가체크

**Seed:** e2e/tests/seed.spec.ts
**전제:** 멱등 시드(seed-test-data.ts) 적용. EvaluationCycle.status=`mid_review`, KPI 4건 `confirmed`, MidtermReview 생성됨.
**Starting state:** test@energyx.co.kr (hr_admin) 인증됨.

---

## Happy Path (hr_admin / 구성원 점검 탭)
1. `page.goto('/eval/midterm')`.
2. 제목 "중간 점검" visible, 부제목 visible.
3. "점검 기간" 배지(teal) + InfoBanner "중간평가는 점검·코칭 단계예요 — 등급·연봉에 반영되지 않아요." visible.
4. (hr_admin은 `showMyTab=false`) "구성원 점검" 콘텐츠(DeptHeadMidterm) 활성.
5. 상위 탭 "구성원 진척 검토 / 재조정 요청 / 조직 진척 요약" 3개 visible, 기본 "구성원 진척 검토".
6. 좌측 팀원 목록(박/이/최테스트)·이름 검색 visible.
7. 팀원 클릭 → 우측 "내 점검" 섹션 탭 4개(KPI 자가점검/종합 코멘트/부서장 피드백/보완조치·재조정) visible.
8. KPI 자가점검 탭에서 KPI 그룹 카드 visible, 자가점검 상태 배너 visible.
9. (제출 완료 팀원) "확인 처리" 버튼 클릭 → 토스트 "자가 점검을 확인 처리했어요." → 상태 "확인 완료".
10. 보완조치 "+ 보완 조치 추가" → ActionItemFormModal → 제목 입력·저장 → 목록에 추가.
11. "재조정 요청" 탭·"조직 진척 요약" 탭 전환 정상.

**Success:** 점검 배지·비구속 배너·3 상위 탭·팀원 점검 패널. **Failure:** 등급/연봉 반영 흔적, 탭 미렌더.

---

## 별도: employee 관점 자가점검 제출 (test1@energyx.co.kr, 박테스트)
**전제:** 멱등 시드. 박테스트 MidtermReview `not_started`/`pending`.
1. test1 계정으로 `/eval/midterm` → "내 점검" 탭 visible (employee는 내 점검만).
2. 섹션 탭 4개 visible, "KPI 자가점검" 활성.
3. KPI 카드 "상반기 실적/진척"·"자가 점검 코멘트" 입력, 정성 KPI "자가 등급 선택" B→해제→A.
4. 하단 "전체 KPI 가중치 합 100% (검증은 백엔드 수행)" visible.
5. "자가 점검 제출" 클릭 → 토스트 "자가 점검을 제출했어요.".
6. "자가 점검 제출 완료 — 부서장 확인 대기 중" 배너, 탭 도트 완료, 버튼 "자가 점검 재제출". 재제출 허용(필드 수정 가능).

---

## Negative: 점검 기간 외(readOnly)
1. cycle `active`에서 `/eval/midterm` → "지금은 점검 기간이 아니에요 (...) 조회만 할 수 있어요." 배너.
2. 입력 필드 disabled, "자가 점검 제출" 버튼 없음.

## Edge: 보완조치 상태 전이
1. ActionItem 있는 팀원 → "보완조치·재조정" 탭 → 상태 `open`→`in_progress` 전환 → 토스트.

## Edge: 목표 재조정 펼치기 / 가중치 합 표시
1. employee "보완조치·재조정" 탭 → "고급 — 목표 재조정" 펼침/접힘(Chevron 토글).
2. "KPI 자가점검" 하단 "전체 KPI 가중치 합 100%" + "(검증은 백엔드 수행)" visible.
