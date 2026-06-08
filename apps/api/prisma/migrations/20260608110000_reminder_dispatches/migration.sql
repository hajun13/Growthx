-- 알림 자동화: 단계별 D-N 리마인더 발송 멱등 추적 테이블.
-- CreateTable
CREATE TABLE "reminder_dispatches" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "offset" INTEGER NOT NULL,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reminder_dispatches_cycle_id_phase_offset_key" ON "reminder_dispatches"("cycle_id", "phase", "offset");

-- CreateIndex
CREATE INDEX "reminder_dispatches_cycle_id_idx" ON "reminder_dispatches"("cycle_id");

-- AddForeignKey
ALTER TABLE "reminder_dispatches" ADD CONSTRAINT "reminder_dispatches_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
