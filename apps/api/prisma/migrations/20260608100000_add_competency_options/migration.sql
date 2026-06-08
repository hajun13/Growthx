-- AlterTable: 역량평가 문항에 커스텀 5지선다 보기(options) 컬럼 추가
-- []=레거시/폴백, 값이 있으면 정확히 5개(서비스 레이어 검증). 인덱스0→점수1(등급D) … 인덱스4→점수5(등급S).
ALTER TABLE "competency_questions" ADD COLUMN IF NOT EXISTS "options" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
