import { Injectable } from '@nestjs/common';
import { KpiCategory, KpiGroup } from '@prisma/client';
import { DeepseekClient } from './deepseek.client';

export interface AiClassifyInput {
  id: number;
  catRaw: string;
  csf: string | null;
  title: string;
  gradingText: string | null;
}
export interface AiClassifyResult {
  id: number;
  category: KpiCategory;
  group: KpiGroup;
  confidence: 'high' | 'low';
}
export interface AiExtractedRow {
  category: KpiCategory;
  group: KpiGroup;
  csf: string | null;
  title: string;
  targetText: string | null;
  measureMethod: string | null;
  weight: number | null;
  isQualitative: boolean;
  gradingCriteria: Record<string, string> | null;
  confidence: 'high' | 'low';
}

const CATEGORIES: { value: KpiCategory; group: KpiGroup; label: string }[] = [
  { value: KpiCategory.revenue, group: KpiGroup.performance_core, label: '매출액' },
  { value: KpiCategory.construction, group: KpiGroup.performance_core, label: '공정액' },
  { value: KpiCategory.orders, group: KpiGroup.performance_core, label: '수주&업무수행성과' },
  { value: KpiCategory.collaboration, group: KpiGroup.collaboration_growth, label: '협업성과' },
  { value: KpiCategory.development, group: KpiGroup.collaboration_growth, label: '자기개발' },
];
const GROUP_BY_CATEGORY = new Map<string, KpiGroup>(CATEGORIES.map((c) => [c.value, c.group]));
const TAXONOMY = CATEGORIES.map((c) => `- ${c.value} (${c.label})`).join('\n');

function asStr(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === 'number') return String(v);
  return null;
}
function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[%\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
/**
 * 가중치(%): commit DTO(@IsInt @Min(0) @Max(100))와 정합 — 정수 반올림 + [0,100] 클램프.
 * LLM 이 33.3(→Prisma Int 500)·1e15(→범위 500)·-50(합계 검증 우회) 같은 값을 내도 여기서 차단.
 */
function asWeight(v: unknown): number | null {
  const n = asNum(v);
  if (n == null) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function asConf(v: unknown): 'high' | 'low' {
  return v === 'high' ? 'high' : 'low';
}
function asCategory(v: unknown): KpiCategory | null {
  return typeof v === 'string' && GROUP_BY_CATEGORY.has(v) ? (v as KpiCategory) : null;
}
function asCriteria(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== 'object') return null;
  const out: Record<string, string> = {};
  for (const g of ['S', 'A', 'B', 'C', 'D']) {
    const s = asStr((v as Record<string, unknown>)[g]);
    if (s) out[g] = s;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * DeepSeek 로 KPI 시트를 구제하는 에이전트.
 * - classifyRows: 파서가 분류 못한 행의 category/group 추론
 * - extractSheet: 헤더 탐지 실패한 시트에서 KPI 행 통째 추출
 * 응답은 반드시 검증(enum·형변환)해 오염을 차단한다. 비활성/실패 시 null.
 */
@Injectable()
export class KpiParseAgent {
  constructor(private readonly client: DeepseekClient) {}

  isEnabled(): boolean {
    return this.client.isEnabled();
  }

  async classifyRows(inputs: AiClassifyInput[]): Promise<AiClassifyResult[] | null> {
    if (!this.client.isEnabled() || inputs.length === 0) return null;
    const system =
      '너는 한국 회사 인사평가 KPI 시트의 "핵심전략" 텍스트를 표준 분류로 매핑하는 도우미야. ' +
      '아래 분류의 category 값 중 하나로만 매핑하고, 반드시 JSON 으로만 답해.\n' +
      `분류(category):\n${TAXONOMY}`;
    const user =
      'JSON 형식: {"rows":[{"id":number,"category":"<category값>","confidence":"high"|"low"}]}\n' +
      '핵심전략·KPI명·전략목표·등급기준을 보고 category 를 골라. 애매하면 confidence=low.\n' +
      '항목: ' +
      JSON.stringify(
        inputs.map((i) => ({
          id: i.id,
          핵심전략: i.catRaw,
          KPI명: i.title,
          전략목표: i.csf,
          등급기준: i.gradingText,
        })),
      );
    const parsed = await this.client.chatJson(system, user);
    const rows = (parsed as { rows?: unknown[] } | null)?.rows;
    if (!Array.isArray(rows)) return null;
    const out: AiClassifyResult[] = [];
    for (const raw of rows) {
      if (!raw || typeof raw !== 'object') continue;
      const o = raw as Record<string, unknown>;
      const category = asCategory(o.category);
      const id = typeof o.id === 'number' ? o.id : null;
      if (category == null || id == null) continue;
      out.push({ id, category, group: GROUP_BY_CATEGORY.get(category)!, confidence: asConf(o.confidence) });
    }
    return out;
  }

  async extractSheet(gridText: string): Promise<AiExtractedRow[] | null> {
    if (!this.client.isEnabled()) return null;
    const system =
      '너는 제각각인 한국 회사 KPI 엑셀 시트에서 KPI 행을 추출하는 도우미야. 반드시 JSON 으로만 답해.\n' +
      `category 는 아래 중 하나:\n${TAXONOMY}`;
    const user =
      'JSON 형식: {"rows":[{"category":"<category값>","csf":string|null,"title":string,' +
      '"targetText":string|null,"measureMethod":string|null,"weight":number|null,' +
      '"isQualitative":boolean,"gradingCriteria":{"S":string,"A":string,"B":string,"C":string,"D":string}|null,' +
      '"confidence":"high"|"low"}]}\n' +
      'title=KPI명, weight=가중치(%) 숫자만. 등급기준(S~D)이 수치면 isQualitative=false, 서술이면 true. 애매하면 confidence=low.\n' +
      '시트 내용(행=줄바꿈, 열=탭):\n' +
      gridText;
    const parsed = await this.client.chatJson(system, user);
    const rows = (parsed as { rows?: unknown[] } | null)?.rows;
    if (!Array.isArray(rows)) return null;
    const out: AiExtractedRow[] = [];
    for (const raw of rows) {
      if (!raw || typeof raw !== 'object') continue;
      const o = raw as Record<string, unknown>;
      const category = asCategory(o.category);
      const title = asStr(o.title);
      if (category == null || !title) continue;
      out.push({
        category,
        group: GROUP_BY_CATEGORY.get(category)!,
        csf: asStr(o.csf),
        title,
        targetText: asStr(o.targetText),
        measureMethod: asStr(o.measureMethod),
        weight: asWeight(o.weight),
        isQualitative: o.isQualitative === true,
        gradingCriteria: asCriteria(o.gradingCriteria),
        confidence: asConf(o.confidence),
      });
    }
    return out;
  }
}
