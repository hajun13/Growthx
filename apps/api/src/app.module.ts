import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { RulesModule } from './common/rules/rules.module';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { FeatureGuard } from './common/guards/feature.guard';
import { ForcePasswordChangeGuard } from './common/guards/force-password-change.guard';

import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { CyclesModule } from './modules/cycles/cycles.module';
import { RuleSetsModule } from './modules/rule-sets/rule-sets.module';
import { KpiTemplatesModule } from './modules/kpi-templates/kpi-templates.module';
import { KpisModule } from './modules/kpis/kpis.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { ResultsModule } from './modules/results/results.module';
import { GroupPerformanceModule } from './modules/group-performance/group-performance.module';
import { GradePoolsModule } from './modules/grade-pools/grade-pools.module';
import { AppealsModule } from './modules/appeals/appeals.module';
import { CompensationsModule } from './modules/compensations/compensations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExcelModule } from './modules/excel/excel.module';
// M3
import { MonthlyPerformanceModule } from './modules/monthly-performance/monthly-performance.module';
import { CompetencyModule } from './modules/competency/competency.module';
// M3 Items1-3
import { KpiCategoryPolicyModule } from './modules/kpi-category-policy/kpi-category-policy.module';
import { OrgChartModule } from './modules/org-chart/org-chart.module';
// 직급 레지스트리(enum Position 폐기 → 관리형 PositionDef)
import { PositionsModule } from './modules/positions/positions.module';
// 권한 설정(서버 영속) + 매트릭스 강제(FeatureGuard).
import { PermissionsModule } from './modules/permissions/permissions.module';
// 6월 중간평가(Model B 체크포인트) — 진척 점검·자가점검/확인·보완 조치(ActionItem).
import { MidtermModule } from './modules/midterm/midterm.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    // 일정 자동화: 마감 D-N 리마인더 크론(NotificationsModule 의 ReminderScheduler).
    ScheduleModule.forRoot(),
    PrismaModule,
    RulesModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    CyclesModule,
    RuleSetsModule,
    KpiTemplatesModule,
    KpisModule,
    AchievementsModule,
    EvaluationsModule,
    ResultsModule,
    // M2
    GroupPerformanceModule,
    GradePoolsModule,
    AppealsModule,
    CompensationsModule,
    NotificationsModule,
    // M2 신규
    AuditLogsModule,
    DashboardModule,
    ExcelModule,
    // M3 신규
    MonthlyPerformanceModule,
    CompetencyModule,
    // M3 Items1-3 신규
    KpiCategoryPolicyModule,
    OrgChartModule,
    PositionsModule,
    PermissionsModule,
    // 6월 중간평가
    MidtermModule,
  ],
  providers: [
    // 전역 가드 실행 순서(등록 순서) — JWT(인증) → Roles(상한) → Feature(추가차단) → 초기비번.
    // FeatureGuard 는 RolesGuard 통과 뒤에만 동작(restrict-only, role 이상 권한 부여 없음). @Public() 은 통과.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
    { provide: APP_GUARD, useClass: ForcePasswordChangeGuard },
  ],
})
export class AppModule {}
