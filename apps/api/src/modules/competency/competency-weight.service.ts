import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user';
import { SetCategoryWeightsDto } from './dto/competency.dto';
import { audienceWeightSums, categoryWeights } from './competency-weight.util';

const AUDIENCE_LABEL = { manager: '직책자', non_manager: '비직책자' } as const;

/**
 * 역량평가 카테고리 가중치 — 같은 주기·같은 카테고리 문항은 모두 같은 weight(카테고리 가중치).
 * 문항 행에 반복 저장하므로, 쓰기는 항상 카테고리 단위 updateMany 로 동일값을 유지한다.
 */
@Injectable()
export class CompetencyWeightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** (주기, 카테고리)의 현재 카테고리 가중치. 그 카테고리에 문항이 없으면 null. */
  async categoryWeight(
    cycleId: string,
    categoryId: string,
    excludeQuestionId?: string,
  ): Promise<number | null> {
    const rows = await this.prisma.competencyQuestion.findMany({
      where: {
        cycleId,
        categoryId,
        ...(excludeQuestionId ? { id: { not: excludeQuestionId } } : {}),
      },
      select: { categoryId: true, weight: true },
    });
    if (!rows.length) return null;
    return categoryWeights(rows).get(categoryId) ?? 0;
  }

  /**
   * 카테고리 가중치 일괄 저장. 저장 결과 기준으로 활성 문항이 있는 평가표(직책자/비직책자)마다
   * 카테고리 가중치 합이 100% 여야 한다('all' 문항 카테고리는 두 평가표에 모두 포함).
   */
  async setCategoryWeights(current: AuthUser, dto: SetCategoryWeightsDto) {
    const ids = dto.weights.map((w) => w.categoryId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('같은 카테고리가 중복되어 있어요.');
    }
    const questions = await this.prisma.competencyQuestion.findMany({
      where: { cycleId: dto.cycleId },
      select: { id: true, categoryId: true, weight: true, targetGroup: true, isActive: true },
    });
    const present = new Set(questions.map((q) => q.categoryId));
    const missing = ids.filter((id) => !present.has(id));
    if (missing.length) {
      throw new BadRequestException('이 주기에 문항이 없는 카테고리는 가중치를 저장할 수 없어요.');
    }

    const next = new Map(dto.weights.map((w) => [w.categoryId, w.weight]));
    const after = questions.map((q) => ({ ...q, weight: next.get(q.categoryId) ?? q.weight }));
    const sums = audienceWeightSums(after);
    for (const audience of ['manager', 'non_manager'] as const) {
      const sum = sums[audience];
      if (sum != null && sum !== 100) {
        throw new BadRequestException({
          code: 'WEIGHT_SUM_INVALID',
          message: `${AUDIENCE_LABEL[audience]} 평가표의 카테고리 가중치 합이 ${sum}%예요. 100%로 맞춰 주세요.`,
        });
      }
    }

    const before = Object.fromEntries(categoryWeights(questions));
    const results = await this.prisma.$transaction(
      dto.weights.map((w) =>
        this.prisma.competencyQuestion.updateMany({
          where: { cycleId: dto.cycleId, categoryId: w.categoryId },
          data: { weight: w.weight },
        }),
      ),
    );
    await this.audit.record({
      entity: 'CompetencyQuestion',
      entityId: dto.cycleId,
      action: 'competency_question.set_category_weights',
      actorId: current.id,
      before,
      after: Object.fromEntries(next),
    });
    return {
      data: {
        cycleId: dto.cycleId,
        updated: results.reduce((s, r) => s + r.count, 0),
        managerSum: sums.manager,
        nonManagerSum: sums.non_manager,
      },
    };
  }
}
