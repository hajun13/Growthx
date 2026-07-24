-- 중간점검 KPI별 조정 코멘트(2026-07-24): 구성원이 수정 제출 시 KPI마다 "무엇을·왜 조정했는지"를 남긴다.
-- 지금까지는 전체 "회신 사유"(memberNote) 1개뿐이라 KPI 단위 조정 근거가 남지 않았다.
-- reviewer_note(부서장 코멘트)와 대칭. 기존 행은 손대지 않는다(nullable 단일 컬럼 추가 — 기본값 NULL).

ALTER TABLE "midterm"."midterm_kpi_check_ins"
  ADD COLUMN "member_note" TEXT;

COMMENT ON COLUMN "midterm"."midterm_kpi_check_ins"."member_note" IS
  '구성원이 중간점검 수정 제출 시 KPI별로 남기는 조정 코멘트(무엇을·왜 조정했는지). reviewer_note(부서장)와 대칭 — 등급/보상 미반영 참고용.';
