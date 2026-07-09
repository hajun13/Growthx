-- 역량평가 다단계 전환: 본인(self) 단독 → 본인 + 1차/2차/최종 평가자(round1~3) 응답.
-- 엑셀 역량평가서(본인·1차·2차·최종 4열 + [종합의견] + 평가점수 환산) 대응.

-- AlterTable: 응답에 단계·작성 평가자 추가. 기존 행은 전부 본인평가(self, evaluator=본인)로 백필.
ALTER TABLE "competency"."competency_responses" ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'self';
ALTER TABLE "competency"."competency_responses" ADD COLUMN "evaluator_id" TEXT;
UPDATE "competency"."competency_responses" SET "evaluator_id" = "user_id";
ALTER TABLE "competency"."competency_responses" ALTER COLUMN "evaluator_id" SET NOT NULL;

CREATE INDEX "competency_responses_evaluator_id_idx" ON "competency"."competency_responses"("evaluator_id");

ALTER TABLE "competency"."competency_responses"
  ADD CONSTRAINT "competency_responses_evaluator_id_fkey"
  FOREIGN KEY ("evaluator_id") REFERENCES "org"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 유일성: (질문, 피평가자, 주기) → (질문, 피평가자, 주기, 단계).
DROP INDEX "competency"."competency_responses_question_id_user_id_cycle_id_key";
CREATE UNIQUE INDEX "competency_responses_question_id_user_id_cycle_id_stage_key"
  ON "competency"."competency_responses"("question_id", "user_id", "cycle_id", "stage");

-- CreateTable: 종합의견(평가자 단계별 자유 서술, 엑셀 [종합의견] 블록).
CREATE TABLE "competency"."competency_opinions" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "evaluator_id" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_opinions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competency_opinions_cycle_id_user_id_stage_key"
  ON "competency"."competency_opinions"("cycle_id", "user_id", "stage");
CREATE INDEX "competency_opinions_user_id_idx" ON "competency"."competency_opinions"("user_id");

ALTER TABLE "competency"."competency_opinions"
  ADD CONSTRAINT "competency_opinions_cycle_id_fkey"
  FOREIGN KEY ("cycle_id") REFERENCES "cycle"."evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competency"."competency_opinions"
  ADD CONSTRAINT "competency_opinions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "org"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "competency"."competency_opinions"
  ADD CONSTRAINT "competency_opinions_evaluator_id_fkey"
  FOREIGN KEY ("evaluator_id") REFERENCES "org"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
