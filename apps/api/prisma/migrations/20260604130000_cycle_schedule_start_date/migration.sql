-- 코드 리뷰 결함 #3: CycleSchedule 활성 윈도우(startDate <= now <= dueDate) 판정용 시작일 컬럼.
ALTER TABLE "cycle_schedules" ADD COLUMN "start_date" TIMESTAMP(3);
