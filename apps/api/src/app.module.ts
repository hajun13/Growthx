import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from './prisma/prisma.module';
import { RulesModule } from './common/rules/rules.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    PrismaModule,
    RulesModule,
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
  ],
  providers: [
    // 전역 가드: JWT 먼저(인증) → Roles(권한). @Public() 은 통과.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
