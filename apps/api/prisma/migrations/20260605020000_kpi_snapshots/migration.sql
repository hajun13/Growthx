-- Cycle Ops §4: 1차 확정 KPI 스냅샷(diff 비교 기준).
-- CreateTable
CREATE TABLE "kpi_snapshots" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpi_snapshots_cycle_id_user_id_idx" ON "kpi_snapshots"("cycle_id", "user_id");

-- AddForeignKey
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "evaluation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
