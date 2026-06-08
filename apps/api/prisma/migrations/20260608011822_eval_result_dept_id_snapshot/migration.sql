-- AlterTable
ALTER TABLE "evaluation_results" ADD COLUMN     "division_id_snapshot" TEXT,
ADD COLUMN     "group_id_snapshot" TEXT,
ADD COLUMN     "team_id_snapshot" TEXT;

-- CreateIndex
CREATE INDEX "evaluation_results_team_id_snapshot_idx" ON "evaluation_results"("team_id_snapshot");

-- CreateIndex
CREATE INDEX "evaluation_results_division_id_snapshot_idx" ON "evaluation_results"("division_id_snapshot");

-- CreateIndex
CREATE INDEX "evaluation_results_group_id_snapshot_idx" ON "evaluation_results"("group_id_snapshot");
