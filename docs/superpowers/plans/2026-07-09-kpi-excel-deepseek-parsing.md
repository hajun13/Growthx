# KPI 엑셀 파싱 DeepSeek AI 폴백 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개인별 KPI 엑셀 임포트에서 결정론적 파서가 깨지는 두 지점(헤더 탐지 실패·분류 인식 실패)을 DeepSeek LLM 폴백으로 구제한다.

**Architecture:** DeepSeek를 `modules/integration/deepseek` 부패방지 어댑터로 격리(client + agent). `ExcelService.parseKpiSheet`(순수·동기)는 그대로 두고, 그 위에 async 래퍼 `parseKpiSheetWithAi`가 파서 실패 시에만 에이전트를 호출한다. 키 미설정 시 AI 경로 전체 스킵.

**Tech Stack:** NestJS(Node 24 native fetch), Prisma enum(KpiCategory/KpiGroup), vitest, ExcelJS, orval codegen, Next.js.

---

## File Structure

- **Create** `apps/api/src/common/config/deepseek.config.ts` — env 읽기 + enabled 판정
- **Create** `apps/api/src/modules/integration/deepseek/deepseek.client.ts` — HTTP 클라이언트(fetch·타임아웃·재시도·JSON)
- **Create** `apps/api/src/modules/integration/deepseek/kpi-parse.agent.ts` — 프롬프트·택소노미·응답 검증(classifyRows·extractSheet)
- **Create** `apps/api/src/modules/integration/deepseek/deepseek.module.ts` — provider/export
- **Create** `apps/api/src/modules/integration/deepseek/kpi-parse.agent.spec.ts` — 목킹 단위 테스트
- **Modify** `apps/api/src/modules/excel/excel.service.ts` — row에 `source`, `parseKpiSheet` unresolved 반환, `parseKpiSheetWithAi`·`sheetGridText` 신설, preview/import 배선, 생성자 주입
- **Modify** `apps/api/src/modules/excel/excel.module.ts` — DeepseekModule import
- **Modify** `apps/api/src/modules/excel/dto/kpi-import-response.dto.ts` — `source` 필드
- **Modify** `packages/contracts/*` — openapi 재발행 + orval 재생성(생성물)
- **Modify** `apps/web/features/admin-kpi-import/ui/AdminKpiImportView.tsx` — "AI 추론" 배지
- **Modify** `.env.example`, `docker-compose.yml` — DEEPSEEK_* 환경변수

---

## Task 1: DeepSeek 설정 모듈

**Files:**
- Create: `apps/api/src/common/config/deepseek.config.ts`

- [ ] **Step 1: 설정 파일 작성** (`jwt.config.ts` 패턴 — env-only)

```ts
/**
 * DeepSeek(외부 LLM) 설정 — env 에서만 읽는다.
 * 키가 없으면 AI 폴백이 자동 비활성되고 기존 결정론적 파서만 동작한다(폐쇄망 안전).
 */
export interface DeepseekSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

/** API 키가 설정돼 있으면 AI 폴백 활성. */
export function deepseekEnabled(): boolean {
  return !!process.env.DEEPSEEK_API_KEY?.trim();
}

/** enabled 일 때만 호출. baseUrl 후행 슬래시 제거, 기본값 보정. */
export function deepseekSettings(): DeepseekSettings {
  return {
    apiKey: (process.env.DEEPSEEK_API_KEY ?? '').trim(),
    baseUrl: (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, ''),
    model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS) || 30000,
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/api/src/common/config/deepseek.config.ts
git commit -m "feat(api): DeepSeek 설정 모듈(env-only, 키 없으면 비활성)"
```

---

## Task 2: DeepSeek HTTP 클라이언트

**Files:**
- Create: `apps/api/src/modules/integration/deepseek/deepseek.client.ts`

- [ ] **Step 1: 클라이언트 작성** (Node 24 native fetch + AbortSignal.timeout, 1회 재시도, 실패 시 null)

```ts
import { Injectable, Logger } from '@nestjs/common';
import { deepseekEnabled, deepseekSettings } from '../../../common/config/deepseek.config';

/**
 * DeepSeek Chat Completions(OpenAI 호환) 얇은 클라이언트.
 * 타임아웃 + 1회 재시도. 비활성·실패 시 null 을 반환해 호출측이 파서 결과로 폴백하게 한다.
 */
@Injectable()
export class DeepseekClient {
  private readonly logger = new Logger(DeepseekClient.name);

  isEnabled(): boolean {
    return deepseekEnabled();
  }

  /** system+user 프롬프트 → JSON 응답 파싱. 실패/비활성 시 null. */
  async chatJson(system: string, user: string): Promise<unknown | null> {
    if (!this.isEnabled()) return null;
    const cfg = deepseekSettings();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
          }),
          signal: AbortSignal.timeout(cfg.timeoutMs),
        });
        if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
        const body = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = body.choices?.[0]?.message?.content;
        if (!content) throw new Error('DeepSeek 응답에 content 가 없어요.');
        return JSON.parse(content);
      } catch (e) {
        this.logger.warn(`DeepSeek 호출 실패(attempt ${attempt + 1}): ${String(e)}`);
        if (attempt === 1) return null;
      }
    }
    return null;
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/api/src/modules/integration/deepseek/deepseek.client.ts
git commit -m "feat(api): DeepSeek HTTP 클라이언트(타임아웃·재시도·JSON 모드)"
```

---

## Task 3: KPI 파싱 에이전트 — 테스트 먼저 (TDD)

**Files:**
- Create: `apps/api/src/modules/integration/deepseek/kpi-parse.agent.ts`
- Test: `apps/api/src/modules/integration/deepseek/kpi-parse.agent.spec.ts`

- [ ] **Step 1: 실패 테스트 작성** (client 목킹 — 실제 네트워크 없음)

```ts
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
    const out = await agent.classifyRows([{ id: 0, catRaw: '매출 확보', csf: null, title: '수주 매출', gradingText: null }]);
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
    expect(await agent.classifyRows([{ id: 0, catRaw: 'x', csf: null, title: 't', gradingText: null }])).toBeNull();
  });

  it('client 가 null(실패)이면 null', async () => {
    const agent = agentWith(async () => null);
    expect(await agent.classifyRows([{ id: 0, catRaw: 'x', csf: null, title: 't', gradingText: null }])).toBeNull();
  });
});

describe('KpiParseAgent.extractSheet', () => {
  it('행을 검증해 AiExtractedRow 로 변환한다', async () => {
    const agent = agentWith(async () => ({
      rows: [{
        category: 'collaboration', title: '팀 협업', csf: null, targetText: '분기 1회',
        measureMethod: '정성', weight: 20, isQualitative: true, gradingCriteria: null, confidence: 'low',
      }],
    }));
    const out = await agent.extractSheet('아무 시트 텍스트');
    expect(out).toEqual([{
      category: KpiCategory.collaboration, group: KpiGroup.collaboration_growth,
      csf: null, title: '팀 협업', targetText: '분기 1회', measureMethod: '정성',
      weight: 20, isQualitative: true, gradingCriteria: null, confidence: 'low',
    }]);
  });

  it('title 없는 행은 버린다', async () => {
    const agent = agentWith(async () => ({ rows: [{ category: 'revenue', title: '', confidence: 'high' }] }));
    expect(await agent.extractSheet('x')).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm -C apps/api exec vitest run src/modules/integration/deepseek/kpi-parse.agent.spec.ts`
Expected: FAIL — `Cannot find module './kpi-parse.agent'`

- [ ] **Step 3: 에이전트 구현**

```ts
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
  if (typeof v === 'string') { const t = v.trim(); return t || null; }
  if (typeof v === 'number') return String(v);
  return null;
}
function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') { const n = Number(v.replace(/[%\s]/g, '')); return Number.isFinite(n) ? n : null; }
  return null;
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
        inputs.map((i) => ({ id: i.id, 핵심전략: i.catRaw, KPI명: i.title, 전략목표: i.csf, 등급기준: i.gradingText })),
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
        weight: asNum(o.weight),
        isQualitative: o.isQualitative === true,
        gradingCriteria: asCriteria(o.gradingCriteria),
        confidence: asConf(o.confidence),
      });
    }
    return out;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm -C apps/api exec vitest run src/modules/integration/deepseek/kpi-parse.agent.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/modules/integration/deepseek/kpi-parse.agent.ts apps/api/src/modules/integration/deepseek/kpi-parse.agent.spec.ts
git commit -m "feat(api): KPI 파싱 에이전트(classifyRows·extractSheet) + 목킹 테스트"
```

---

## Task 4: DeepSeek 모듈 + ExcelModule 배선

**Files:**
- Create: `apps/api/src/modules/integration/deepseek/deepseek.module.ts`
- Modify: `apps/api/src/modules/excel/excel.module.ts`

- [ ] **Step 1: 모듈 작성**

```ts
import { Module } from '@nestjs/common';
import { DeepseekClient } from './deepseek.client';
import { KpiParseAgent } from './kpi-parse.agent';

@Module({
  providers: [DeepseekClient, KpiParseAgent],
  exports: [KpiParseAgent],
})
export class DeepseekModule {}
```

- [ ] **Step 2: ExcelModule 에 import 추가**

`apps/api/src/modules/excel/excel.module.ts` 를 아래로 교체:

```ts
import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { ExcelController } from './excel.controller';
import { CompensationsModule } from '../compensations/compensations.module';
import { DeepseekModule } from '../integration/deepseek/deepseek.module';

@Module({
  imports: [CompensationsModule, DeepseekModule],
  controllers: [ExcelController],
  providers: [ExcelService],
  exports: [ExcelService],
})
export class ExcelModule {}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/api/src/modules/integration/deepseek/deepseek.module.ts apps/api/src/modules/excel/excel.module.ts
git commit -m "feat(api): DeepseekModule + ExcelModule 배선"
```

---

## Task 5: ExcelService — row `source` + `parseKpiSheet` unresolved 반환

**Files:**
- Modify: `apps/api/src/modules/excel/excel.service.ts`

- [ ] **Step 1: 생성자에 KpiParseAgent 주입**

`excel.service.ts` 상단 import 에 추가:
```ts
import { KpiParseAgent } from '../integration/deepseek/kpi-parse.agent';
```
생성자에 파라미터 추가(기존 생성자 파라미터 뒤에):
```ts
    private readonly kpiParseAgent: KpiParseAgent,
```

- [ ] **Step 2: parseKpiSheet 반환 타입에 `source`·`unresolved` 추가**

`parseKpiSheet` 반환 타입 선언(현재 `rows: {...}[]; errors; warnings; sheetName`)에서 rows 항목에 `source: 'parser' | 'ai';` 를 추가하고, 최상위에 다음을 추가:
```ts
    unresolved: {
      idx: number;
      catRaw: string;
      title: string;
      gradingText: string | null;
      errObj: { row: number; message: string };
    }[];
```

- [ ] **Step 3: unresolved 수집 + source 세팅**

`parseKpiSheet` 본문에서 `const warnings: string[] = [];` 아래에 추가:
```ts
    const unresolved: ReturnType<ExcelService['parseKpiSheet']>['unresolved'] = [];
```
조기 반환 3곳(`return { rows, errors, warnings, sheetName ... }`)에 `unresolved` 를 함께 반환하도록 수정(빈 배열 포함).

분류 실패 분기(현재):
```ts
      if (!resolved) {
        valid = false;
        message = `핵심전략 '${catRaw || '(빈칸)'}'을(를) 인식하지 못했어요 — 분류를 직접 선택해 주세요.`;
        errors.push({ row: r, message });
      } else if (!title) {
```
를 아래로 교체(errObj 참조 보관 + unresolved 수집; idx = 곧 push 될 row 의 인덱스):
```ts
      if (!resolved) {
        valid = false;
        message = `핵심전략 '${catRaw || '(빈칸)'}'을(를) 인식하지 못했어요 — 분류를 직접 선택해 주세요.`;
        const errObj = { row: r, message };
        errors.push(errObj);
        const gradingText = gradingCriteria ? Object.values(gradingCriteria).join(' ') : null;
        unresolved.push({ idx: rows.length, catRaw, title, gradingText, errObj });
      } else if (!title) {
```

`rows.push({ ... })` 객체에 `source: 'parser',` 추가.

마지막 `return { rows, errors, warnings, sheetName: ws.name };` 를 `return { rows, errors, warnings, sheetName: ws.name, unresolved };` 로.

- [ ] **Step 4: 컴파일 확인**

Run: `pnpm -C apps/api exec tsc --noEmit`
Expected: PASS (0 errors) — preview/import 는 아직 `unresolved`/`source` 를 안 쓰지만 타입 정합.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/modules/excel/excel.service.ts
git commit -m "feat(api): parseKpiSheet 에 source·unresolved 노출(AI 폴백 준비)"
```

---

## Task 6: ExcelService — `parseKpiSheetWithAi` 래퍼 + preview/import 배선

**Files:**
- Modify: `apps/api/src/modules/excel/excel.service.ts`

- [ ] **Step 1: sheetGridText 헬퍼 추가** (`parseKpiSheet` 아래에)

```ts
  /** 시트를 탭/개행 텍스트 그리드로(토큰 상한: 60행 × 20열). AI extractSheet 입력. */
  private sheetGridText(ws: ExcelJS.Worksheet): string {
    const maxRow = Math.min(ws.rowCount, 60);
    const maxCol = Math.min(ws.columnCount || 20, 20);
    const lines: string[] = [];
    for (let r = 1; r <= maxRow; r++) {
      const cells: string[] = [];
      for (let c = 1; c <= maxCol; c++) cells.push(this.cellText(ws, r, c).replace(/\t/g, ' '));
      if (cells.some((x) => x.trim())) lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }
```

- [ ] **Step 2: parseKpiSheetWithAi 래퍼 추가** (sheetGridText 아래에)

```ts
  /**
   * parseKpiSheet(결정론적) 위 AI 폴백 래퍼.
   * - 헤더 탐지 실패(0행) → extractSheet 로 통째 추출
   * - 분류 인식 실패 행 → classifyRows 로 보완
   * AI 가 채운 행은 source:'ai'. 비활성/실패 시 파서 결과 그대로(+warning).
   */
  private async parseKpiSheetWithAi(wb: ExcelJS.Workbook): Promise<{
    rows: ReturnType<ExcelService['parseKpiSheet']>['rows'];
    errors: { row: number; message: string }[];
    warnings: string[];
    sheetName: string;
  }> {
    const base = this.parseKpiSheet(wb);
    const strip = { rows: base.rows, errors: base.errors, warnings: base.warnings, sheetName: base.sheetName };
    if (!this.kpiParseAgent.isEnabled()) return strip;

    // 모드 B: 헤더 탐지 실패 → 시트 통째 AI 추출
    if (base.rows.length === 0) {
      const ws = this.pickKpiSheet(wb);
      if (!ws) return strip;
      const extracted = await this.kpiParseAgent.extractSheet(this.sheetGridText(ws));
      if (!extracted || extracted.length === 0) {
        return { ...strip, warnings: [...base.warnings, 'AI 보완에 실패했어요 — 파서 결과만 표시해요.'] };
      }
      const rows = extracted.map((e) => {
        const valid = e.confidence === 'high';
        return {
          category: e.category, group: e.group, csf: e.csf, title: e.title,
          targetText: e.targetText, measureMethod: e.measureMethod, weight: e.weight,
          isQualitative: e.isQualitative, gradingCriteria: e.gradingCriteria,
          valid, source: 'ai' as const,
          message: valid ? 'AI 가 시트에서 추출했어요 — 확인해 주세요.' : 'AI 추출이 불확실해요 — 확인해 주세요.',
        };
      });
      const aiSum = rows.reduce((s, r) => s + (r.weight ?? 0), 0);
      const warnings = [...base.warnings, `AI 가 시트에서 ${rows.length}개 KPI 를 추출했어요 — 확인해 주세요.`];
      if (Math.abs(aiSum - 100) > 10) warnings.push(`AI 추출 가중치 합이 ${aiSum}% 예요 — 100% 인지 확인해 주세요.`);
      return { rows, errors: [], warnings, sheetName: base.sheetName };
    }

    // 모드 A: 분류 인식 실패 행만 AI 분류
    if (base.unresolved.length === 0) return strip;
    const results = await this.kpiParseAgent.classifyRows(
      base.unresolved.map((u) => ({ id: u.idx, catRaw: u.catRaw, csf: null, title: u.title, gradingText: u.gradingText })),
    );
    if (!results || results.length === 0) {
      return { ...strip, warnings: [...base.warnings, 'AI 보완에 실패했어요 — 파서 결과만 표시해요.'] };
    }
    const rows = [...base.rows];
    let errorsOut = base.errors;
    let filled = 0;
    for (const res of results) {
      const row = rows[res.id];
      const u = base.unresolved.find((x) => x.idx === res.id);
      if (!row || !u) continue;
      const valid = res.confidence === 'high' && !!row.title;
      rows[res.id] = {
        ...row,
        category: res.category,
        group: res.group,
        valid,
        source: 'ai',
        message: valid
          ? `AI 가 '${ExcelService.KPI_CATEGORY_LABEL[res.category]}' 분류로 추론했어요 — 확인해 주세요.`
          : 'AI 도 분류가 불확실해요 — 직접 선택해 주세요.',
      };
      if (valid) errorsOut = errorsOut.filter((e) => e !== u.errObj);
      filled++;
    }
    return {
      rows,
      errors: errorsOut,
      warnings: [...base.warnings, `AI 가 ${filled}개 행의 분류를 추론했어요 — 확인해 주세요.`],
      sheetName: base.sheetName,
    };
  }
```

- [ ] **Step 3: previewKpi 배선** — `const { rows, errors, warnings } = this.parseKpiSheet(wb);` 를:
```ts
    const { rows, errors, warnings } = await this.parseKpiSheetWithAi(wb);
```

- [ ] **Step 4: importKpi 배선** — `const { rows, errors, warnings: parseWarnings } = this.parseKpiSheet(wb);` 를:
```ts
    const { rows, errors, warnings: parseWarnings } = await this.parseKpiSheetWithAi(wb);
```

- [ ] **Step 5: 컴파일 확인**

Run: `pnpm -C apps/api exec tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/modules/excel/excel.service.ts
git commit -m "feat(api): parseKpiSheetWithAi — 헤더 실패→추출·분류 실패→보완 폴백"
```

---

## Task 7: DTO `source` 필드 + 계약 재생성

**Files:**
- Modify: `apps/api/src/modules/excel/dto/kpi-import-response.dto.ts`
- Modify (생성물): `packages/contracts/openapi.json`, `packages/contracts/src/generated/**`

- [ ] **Step 1: DTO 에 source 추가** — `KpiImportRowDto` 의 `valid!` 앞에:

```ts
  @ApiProperty({ enum: ['parser', 'ai'], description: '행 출처 — parser(결정론적)·ai(DeepSeek 추론)' })
  source!: 'parser' | 'ai';
```

- [ ] **Step 2: openapi.json 재발행**

Run: `pnpm -C apps/api run openapi`
Expected: `dist/src/openapi-gen.js` 실행 완료, `packages/contracts/openapi.json` 갱신(`source` 포함)

- [ ] **Step 3: orval 재생성**

Run: `pnpm -C packages/contracts run generate`
Expected: `src/generated/model/kpiImportRowDto.ts` 에 `source` 필드 생성

- [ ] **Step 4: 컴파일 확인**

Run: `pnpm -C apps/api exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/modules/excel/dto/kpi-import-response.dto.ts packages/contracts/openapi.json packages/contracts/src/generated
git commit -m "feat(contracts): KpiImportRowDto.source 필드(parser|ai) 재생성"
```

---

## Task 8: 프론트 — "AI 추론" 배지

**Files:**
- Modify: `apps/web/features/admin-kpi-import/ui/AdminKpiImportView.tsx`

- [ ] **Step 1: nextjs-frontend 스킬 호출**

이 작업 전 `nextjs-frontend` 스킬을 Skill 도구로 호출한다(프론트 규약 준수).

- [ ] **Step 2: 로컬 RowState 에 source 반영** — preview 행을 로컬 상태로 매핑하는 곳(약 line 460~470, `valid: r.valid, message: r.message,` 부근)에 `source: r.source,` 를 추가하고, 로컬 Row 타입에 `source?: 'parser' | 'ai'` 를 추가한다. (신규 빈 행 생성부 line 71 부근은 `source: 'parser'` 로 기본.)

- [ ] **Step 3: 배지 렌더** — category 셀(약 line 293~297, `{row.message && ...}` 위)에 추가:

```tsx
{row.source === 'ai' && (
  <span className="inline-flex items-center rounded-sm bg-purple-100 px-1 py-0.5 text-[10px] font-medium text-purple-700 mt-0.5">
    AI 추론
  </span>
)}
```
(팔레트: DESIGN.md 등급/강조와 충돌 없는 중립 표식 — 기존 warning-700 텍스트와 나란히. 정확한 클래스는 프로젝트 토큰에 맞춰 조정.)

- [ ] **Step 4: 타입/빌드 확인**

Run: `pnpm -C apps/web exec tsc --noEmit && pnpm -C apps/web run build`
Expected: PASS (35 라우트)

- [ ] **Step 5: 커밋**

```bash
git add apps/web/features/admin-kpi-import/ui/AdminKpiImportView.tsx
git commit -m "feat(web): KPI 임포트 미리보기에 AI 추론 배지"
```

---

## Task 9: 환경변수 템플릿

**Files:**
- Modify: `.env.example`, `docker-compose.yml`

- [ ] **Step 1: .env.example 에 추가**

```
# DeepSeek AI KPI 파싱 폴백(선택) — 키가 없으면 결정론적 파서만 동작.
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_MS=30000
```

- [ ] **Step 2: docker-compose.yml 의 api 서비스 environment 에 추가**

```yaml
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
      DEEPSEEK_BASE_URL: ${DEEPSEEK_BASE_URL:-https://api.deepseek.com}
      DEEPSEEK_MODEL: ${DEEPSEEK_MODEL:-deepseek-chat}
      DEEPSEEK_TIMEOUT_MS: ${DEEPSEEK_TIMEOUT_MS:-30000}
```
(실제 compose 파일의 api 서비스 `environment:` 키 이름/들여쓰기에 맞춰 삽입.)

- [ ] **Step 3: 커밋**

```bash
git add .env.example docker-compose.yml
git commit -m "chore: DEEPSEEK_* 환경변수 템플릿(선택·미설정 시 비활성)"
```

---

## Task 10: 전체 검증

- [ ] **Step 1: api 테스트·타입**

Run: `pnpm -C apps/api exec vitest run && pnpm -C apps/api exec tsc --noEmit`
Expected: 전 테스트 PASS, tsc 0

- [ ] **Step 2: web 타입·빌드**

Run: `pnpm -C apps/web exec tsc --noEmit && pnpm -C apps/web run build`
Expected: tsc 0, build PASS

- [ ] **Step 3: 회귀 확인(구조적)** — `DEEPSEEK_API_KEY` 미설정(로컬 기본)에서 `previewKpi` 가 `parseKpiSheetWithAi` 의 `!isEnabled()` 조기 반환으로 기존 파서와 동일 출력임을 코드로 확인(래퍼 1행 가드). 키 설정 시에만 AI 경로 진입.

- [ ] **Step 4: (선택) 라이브 확인** — 키가 있으면 이미지 재빌드 후 실제 깨진 양식 파일을 `POST /excel/import/kpi/preview` 로 올려 `source:'ai'` 행·warnings 확인. 키 없으면 이 단계 건너뜀(기존 파서만).

---

## Self-Review 결과

- **Spec 커버리지:** 아키텍처(T1~4)·파이프라인 둘 다(T6)·전송 최소화(T3 프롬프트)·신뢰표시(T6·T7·T8)·회복탄력성(T2·T6)·env(T9)·테스트(T3·T10) 전부 태스크 존재.
- **플레이스홀더:** 없음(모든 코드 블록 실제 구현).
- **타입 정합:** `AiClassifyResult`/`AiExtractedRow`/`source:'parser'|'ai'`/`unresolved.errObj` 가 T3·T5·T6·T7 에서 일관.
- **주의:** T5·T6·T8 의 라인 번호는 근사치 — 실제 편집 시 앵커 텍스트로 매칭한다.
