import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from './prisma/prisma.module';
import { RulesModule } from './common/rules/rules.module';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
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
  ],
  providers: [
    // 전역 가드: JWT 먼저(인증) → Roles(권한) → 초기비번 강제변경. @Public() 은 통과.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ForcePasswordChangeGuard },
  ],
})
export class AppModule {}
