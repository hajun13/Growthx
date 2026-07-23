-- 중간점검 수정안 임시저장(2026-07-23): 본인이 아직 제출하지 않은 작업본을 서버에 보관한다.
-- 지금까지 수정 화면의 입력은 브라우저 메모리에만 있어서 탭을 닫으면 사라졌다.
-- 기존 행은 손대지 않는다(nullable 단일 컬럼 추가 — 기본값 NULL = 임시저장본 없음).

ALTER TABLE "midterm"."midterm_reviews"
  ADD COLUMN "revision_draft" JSONB;

COMMENT ON COLUMN "midterm"."midterm_reviews"."revision_draft" IS
  '피평가자 본인의 미제출 수정안 { items: [{kpiId,targetValue?,targetText?,weight?}], memberNote, savedAt }. 제출 시 JSON null(''null''::jsonb) 로 비움 — SQL NULL 이 아니므로 IS NULL 로는 걸러지지 않는다(초안 없음 판정은 SQL NULL 과 JSON null 을 모두 봐야 한다).';
