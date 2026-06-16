-- 보상 수기 조정(CompensationAdjustment) — 2026 연봉갱신 엑셀(T~AC) 양식 반영.
-- 관리자(hr_admin)가 (user, cycle)별로 조정분·승격·인센티브·비고를 수기 입력·저장.
-- 자동 산정(Compensation)과 별개 테이블이며 시뮬레이션 응답에 병합되어 최종 제안연봉·인상률을 산출.
-- compensation 스키마 소유. 교차참조 FK 는 org.users / cycle.evaluation_cycles 로 강제(promotion_position_code 는 FK 강제 안 함).

-- CreateTable
CREATE TABLE "compensation"."compensation_adjustments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "adjustment_amount" INTEGER,
    "promotion_position_code" TEXT,
    "incentive_amount" INTEGER,
    "note" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compensation_adjustments_user_id_cycle_id_key" ON "compensation"."compensation_adjustments"("user_id", "cycle_id");

-- AddForeignKey
ALTER TABLE "compensation"."compensation_adjustments" ADD CONSTRAINT "compensation_adjustments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "org"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation"."compensation_adjustments" ADD CONSTRAINT "compensation_adjustments_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycle"."evaluation_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
