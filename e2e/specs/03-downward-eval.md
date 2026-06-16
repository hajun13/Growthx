# 03 — 부서장 3단계 평가 (downward evaluation)

**Seed:** e2e/tests/seed.spec.ts
**전제:** 멱등 시드(seed-test-data.ts) 적용. 다단계 부서장 평가(round1 팀장 / round2 본부장 / round3 그룹대표). test@energyx.co.kr이 round1 평가자, 팀원(박/이/최테스트) 일부는 본인평가 `submitted`.
**Starting state:** test@energyx.co.kr (hr_admin, 팀장 역할) 인증됨.

---

## Happy Path: 부서장 평가 접근 → 팀원 선택 → 제출
1. `page.goto('/eval/dept-head')`.
2. 제목 "부서장 평가" visible, 부제목 visible.
3. 진행 요약 카드 4개(전체 팀원/평가 완료/평가중/평가 대기) 렌더, "전체 팀원" ≥ 1.
4. 좌측 팀원 목록·이름 검색 입력 visible, 팀원(박/이/최테스트) 항목·상태 배지 visible.
5. 팀원 클릭 → 우측 패널 헤더에 **라운드 뱃지**("1차 · 팀장" / "2차 · 본부장" / "최종 · 그룹대표") visible. (시드: round1 → "1차 · 팀장")
6. "본인평가" 연동 배너(제출 시 teal "실적 연동" / 미제출 시 주황) visible.
7. (본인평가 submitted 팀원 선택) KPI 그룹 섹션·"본인평가" 실적 행 visible.
8. 정성 KPI "부서장 등급 부여" GradeCriteriaPicker에서 등급 클릭 → 선택 상태.
9. "종합 평가 코멘트 *" textarea 입력(필수).
10. 코멘트 입력 후 "부서장 평가 제출" 활성 → 클릭 → 확인 모달 → "제출".
11. 성공 토스트 "부서장 평가를 제출했어요." + "평가 제출 완료" 배너.

**Success:** 라운드 뱃지·코멘트 게이트·제출 완료 배너. **Failure:** 뱃지 미표시, 코멘트 없이 제출 허용.

---

## Negative: 코멘트 미작성 시 제출 차단
1. submitted 팀원 선택, 정성 등급 부여, 코멘트 비움.
2. 제출 버튼 "종합 평가 코멘트를 작성해 주세요"로 비활성, 코멘트 테두리 빨강, 필수 에러 텍스트 visible.

## Negative: 정성 KPI 등급 미부여 시 제출 차단
1. 코멘트는 입력, 정성 등급 미선택 → 제출 버튼 "정성 과제 등급을 모두 부여해 주세요" 비활성.

## Edge: 이름 검색 필터
1. 검색 "박" → 박테스트만, 나머지 사라짐. 지우면 복원. "zzz" → "검색 결과가 없어요.".

## Edge: 그룹 등급 풀 분포
1. 하단 "그룹 등급 풀 분포" 섹션·S/A/B/C/D 막대 차트 visible (GradePool 있으면 풀 상한 점선).

## Edge: 종합등급 직접 부여
1. "종합등급 직접 부여 (선택)" details 펼침 → GradePicker visible.
2. 등급 선택 시 "이유" textarea 필수 → 미입력 시 제출 비활성, 입력 시 활성. "자동 산정" 링크로 초기화.
