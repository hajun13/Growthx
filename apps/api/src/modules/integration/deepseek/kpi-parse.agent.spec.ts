import { describe, it, expect, vi } from 'vitest';
import { KpiCategory, KpiGroup } from '@prisma/client';
import { KpiParseAgent } from './kpi-parse.agent';
import type { DeepseekClient } from './deepseek.client';

function agentWith(chatJson: () => Promise<unknown | null>, enabled = true) {
  const client = { isEnabled: () => enabled, chatJson: vi.fn(chatJson) } as unknown as DeepseekClient;
  return new KpiParseAgent(client);
}

describe('KpiParseAgent.classifyRows', () => {
  it('유효 enum 을 group 과 함께 매핑한다', async () => {
    const agent = agentWith(async () => ({
      rows: [{ id: 0, category: 'revenue', confidence: 'high' }],
    }));
    const out = await agent.classifyRows([
      { id: 0, catRaw: '매출 확보', csf: null, title: '수주 매출', gradingText: null },
    ]);
    expect(out).toEqual([
      { id: 0, category: KpiCategory.revenue, group: KpiGroup.performance_core, confidence: 'high' },
    ]);
  });

  it('알 수 없는 category 는 버린다', async () => {
    const agent = agentWith(async () => ({ rows: [{ id: 0, category: 'nonsense', confidence: 'high' }] }));
    const out = await agent.classifyRows([{ id: 0, catRaw: 'x', csf: null, title: 't', gradingText: null }]);
    expect(out).toEqual([]);
  });

  it('client 비활성이면 null', async () => {
    const agent = agentWith(async () => ({}), false);
    expect(
      await agent.classifyRows([{ id: 0, catRaw: 'x', csf: null, title: 't', gradingText: null }]),
    ).toBeNull();
  });

  it('client 가 null(실패)이면 null', async () => {
    const agent = agentWith(async () => null);
    expect(
      await agent.classifyRows([{ id: 0, catRaw: 'x', csf: null, title: 't', gradingText: null }]),
    ).toBeNull();
  });
});

describe('KpiParseAgent.extractSheet', () => {
  it('행을 검증해 AiExtractedRow 로 변환한다', async () => {
    const agent = agentWith(async () => ({
      rows: [
        {
          category: 'collaboration',
          title: '팀 협업',
          csf: null,
          targetText: '분기 1회',
          measureMethod: '정성',
          weight: 20,
          isQualitative: true,
          gradingCriteria: null,
          confidence: 'low',
        },
      ],
    }));
    const out = await agent.extractSheet('아무 시트 텍스트');
    expect(out).toEqual([
      {
        category: KpiCategory.collaboration,
        group: KpiGroup.collaboration_growth,
        csf: null,
        title: '팀 협업',
        targetText: '분기 1회',
        measureMethod: '정성',
        weight: 20,
        isQualitative: true,
        gradingCriteria: null,
        confidence: 'low',
      },
    ]);
  });

  it('title 없는 행은 버린다', async () => {
    const agent = agentWith(async () => ({ rows: [{ category: 'revenue', title: '', confidence: 'high' }] }));
    expect(await agent.extractSheet('x')).toEqual([]);
  });
});
