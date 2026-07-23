import { Module } from '@nestjs/common';
import { MidtermController } from './midterm.controller';
import { ActionItemsController } from './action-items.controller';
import { MidtermProgressService } from './midterm-progress.service';
import { MidtermSummaryService } from './midterm-summary.service';
import { MidtermReviewsService } from './midterm-reviews.service';
import { ActionItemsService } from './action-items.service';
import { RebaselineService } from './rebaseline.service';
import { MidtermTrailService } from './midterm-trail.service';
import { MidtermReviewFlowService } from './midterm-review-flow.service';
import { MidtermNotifyService } from './midterm-notify.service';
import { KpisModule } from '../kpis/kpis.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * 6월 중간평가 모듈 — Model B(체크포인트) 비구속 점검·피드백.
 *  - ② 진척 점검(MidtermProgressService) + 자가점검/부서장 확인(MidtermReviewsService).
 *    HR 진행 현황 집계(MidtermSummaryService, 설계 §7.5)는 같은 데이터를 읽기 전용으로만 본다
 *    — 단계별 인원수·미착수자(누구를 기다리는지). 판정은 midterm-summary.util 의 순수 함수.
 *  - ③ 피드백 보완 조치(ActionItemsService) — 최종등급 미반영(참고용).
 *  - ④ 중간 KPI 목표 재조정(RebaselineService) — mid_review 단계 한정, KpiSnapshot+AuditLog 이력.
 *    검증·적용 엔진은 KpisModule 이 제공하는 KpiRevisionService 를 공유(KpisModule 은
 *    MidtermModule 을 참조하지 않으므로 순환 의존 없음).
 *  - ⑤ 2단계 흐름(MidtermReviewFlowService, 2026-07-23) — 1차 코멘트 → 본인 수정 → 2차 판정.
 *    레거시 자가점검(MidtermReviewsService)과 당분간 공존하며, 이력은 MidtermTrailService 가 남긴다.
 *    알림·메일(MidtermNotifyService)은 흐름 서비스가 돌려주는 NotifyIntent[] 를 트랜잭션
 *    커밋 후(Task 8 컨트롤러) 소비 — NotificationsModule 은 MidtermModule 을 참조하지 않아
 *    순환 의존 없음.
 * 등급·보상 게이팅(①)은 results/compensations 서비스 진입부(assertFinalStage)에서 강제.
 */
@Module({
  imports: [NotificationsModule, KpisModule],
  controllers: [MidtermController, ActionItemsController],
  providers: [
    MidtermProgressService,
    MidtermSummaryService,
    MidtermReviewsService,
    MidtermReviewFlowService,
    MidtermTrailService,
    MidtermNotifyService,
    ActionItemsService,
    RebaselineService,
  ],
  exports: [ActionItemsService],
})
export class MidtermModule {}
