-- 생년월일(birth_date) — 나이(만 나이)는 응답에서 birth_date 로부터 파생(저장 안 함).
-- 조직도 기초DATA(생년월일) 적재·표시용. nullable(미입력 허용).
ALTER TABLE "org"."users" ADD COLUMN "birth_date" TIMESTAMP(3);
