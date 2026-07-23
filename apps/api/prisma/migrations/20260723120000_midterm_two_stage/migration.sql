-- 중간점검 재편(2026-07-23): 자가점검 → 본부장 1차 코멘트 + 본인 수정 + 그룹대표 2차 검토.
-- 기존 행은 손대지 않는다(전 신규 컬럼 nullable/default).

-- 1) 상태 enum 확장.
ALTER TYPE "midterm"."MidtermReviewStatus" ADD VALUE IF NOT EXISTS 'commented';
ALTER TYPE "midterm"."MidtermReviewStatus" ADD VALUE IF NOT EXISTS 'revised';
ALTER TYPE "midterm"."MidtermReviewStatus" ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE "midterm"."MidtermReviewStatus" ADD VALUE IF NOT EXISTS 'closed';

-- 2) 리뷰 테이블에 2단계 흐름 컬럼.
ALTER TABLE "midterm"."midterm_reviews"
  ADD COLUMN "first_reviewer_id" TEXT,
  ADD COLUMN "first_comment" TEXT,
  ADD COLUMN "first_commented_at" TIMESTAMP(3),
  ADD COLUMN "member_note" TEXT,
  ADD COLUMN "member_submitted_at" TIMESTAMP(3),
  ADD COLUMN "final_reviewer_id" TEXT,
  ADD COLUMN "final_comment" TEXT,
  ADD COLUMN "decided_at" TIMESTAMP(3),
  ADD COLUMN "revision_round" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "midterm"."midterm_reviews"
  ADD CONSTRAINT "midterm_reviews_first_reviewer_id_fkey"
  FOREIGN KEY ("first_reviewer_id") REFERENCES "org"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "midterm"."midterm_reviews"
  ADD CONSTRAINT "midterm_reviews_final_reviewer_id_fkey"
  FOREIGN KEY ("final_reviewer_id") REFERENCES "org"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) 진행 이력 테이블.
CREATE TABLE "midterm"."midterm_trails" (
  "id" TEXT NOT NULL,
  "midterm_review_id" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "actor_name" TEXT NOT NULL,
  "actor_position" TEXT,
  "on_behalf_of" BOOLEAN NOT NULL DEFAULT false,
  "comment" TEXT,
  "kpi_changes" JSONB,
  "snapshot_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "midterm_trails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "midterm_trails_midterm_review_id_seq_key"
  ON "midterm"."midterm_trails"("midterm_review_id", "seq");
CREATE INDEX "midterm_trails_midterm_review_id_idx"
  ON "midterm"."midterm_trails"("midterm_review_id");
CREATE INDEX "midterm_trails_actor_id_idx" ON "midterm"."midterm_trails"("actor_id");

ALTER TABLE "midterm"."midterm_trails"
  ADD CONSTRAINT "midterm_trails_midterm_review_id_fkey"
  FOREIGN KEY ("midterm_review_id") REFERENCES "midterm"."midterm_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "midterm"."midterm_trails"
  ADD CONSTRAINT "midterm_trails_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "org"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
