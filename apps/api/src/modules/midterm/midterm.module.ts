import { Module } from '@nestjs/common';
import { MidtermController } from './midterm.controller';
import { ActionItemsController } from './action-items.controller';
import { MidtermProgressService } from './midterm-progress.service';
import { MidtermReviewsService } from './midterm-reviews.service';
import { ActionItemsService } from './action-items.service';
import { RebaselineService } from './rebaseline.service';
import { MidtermTrailService } from './midterm-trail.service';
import { KpisModule } from '../kpis/kpis.module';

/**
 * 6월 중간평가 모듈 — Model B(체크포인트) 비구속 점검·피드백.
 *  - ② 진척 점검(MidtermProgressService) + 자가점검/부서장 확인(MidtermReviewsService).
 *  - ③ 피드백 보완 조치(ActionItemsService) — 최종등급 미반영(참고용).
 *  - ④ 중간 KPI 목표 재조정(RebaselineService) — mid_review 단계 한정, KpiSnapshot+AuditLog 이력.
 *    검증·적용 엔진은 KpisModule 이 제공하는 KpiRevisionService 를 공유(KpisModule 은
 *    MidtermModule 을 참조하지 않으므로 순환 의존 없음).
 * 등급·보상 게이팅(①)은 results/compensations 서비스 진입부(assertFinalStage)에서 강제.
 */
@Module({
  imports: [KpisModule],
  controllers: [MidtermController, ActionItemsController],
  providers: [
    MidtermProgressService,
    MidtermReviewsService,
    ActionItemsService,
    RebaselineService,
    MidtermTrailService,
  ],
  exports: [ActionItemsService],
})
export class MidtermModule {}
