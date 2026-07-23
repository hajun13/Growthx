import { describe, it, expect } from 'vitest';
import { CycleStatus, CycleType } from '@prisma/client';
import {
  buildSalaryChain,
  pickAuthoritativeCyclePerYear,
  type CycleCandidate,
} from './previous-salary.deriver';

const step = (id: string, year: number) => ({ id, year });

describe('buildSalaryChain — 앵커링(수기 전년도) 규칙', () => {
  it('직전 사이클이 있어도 데이터가 없으면 수기 previousSalary 가 살아남는다', () => {
    // FIX 1(a): 이전 구현은 첫 스텝이 previous 를 base 로 무조건 덮어써 수기 값이 사장됐다.
    const chain = buildSalaryChain(
      [step('c25', 2025)],
      { currentSalary: 5000, previousSalary: 4800 },
      new Map(),
      new Map(),
    );
    expect(chain.currentSalary).toBe(5000);
    expect(chain.previous).toEqual({ value: 4800, source: 'manual' });
  });

  it('데이터 없는 스텝에서 전년도=금년도를 지어내지 않는다(수기 값도 없으면 none)', () => {
    const chain = buildSalaryChain(
      [step('c25', 2025)],
      { currentSalary: 5000, previousSalary: null },
      new Map(),
      new Map(),
    );
    expect(chain.currentSalary).toBe(5000);
    expect(chain.previous).toEqual({ value: null, source: 'none' });
  });

  it('base=null(금년도 앵커 미입력)이어도 수기 previous 를 none 으로 강등하지 않는다', () => {
    // FIX 1(b): 이전 구현은 base=null 스텝에서 previous={null,'none'} 으로 덮어썼다.
    const chain = buildSalaryChain(
      [step('c25', 2025)],
      { currentSalary: null, previousSalary: 4800 },
      new Map(),
      new Map([['c25', 300]]),
    );
    expect(chain.currentSalary).toBeNull();
    expect(chain.previous).toEqual({ value: 4800, source: 'manual' });
  });

  it('실데이터(조정분) 스텝에서는 진짜 이월값이 수기 값을 대체한다 — 기존 동작 보존', () => {
    // 2025 스텝(도입연도 이전 → 인상률 0%) + 조정분 300: base 5000 → 5300, previous ← 5000.
    const chain = buildSalaryChain(
      [step('c25', 2025)],
      { currentSalary: 5000, previousSalary: 4800 },
      new Map(),
      new Map([['c25', 300]]),
    );
    expect(chain.currentSalary).toBe(5300);
    expect(chain.previous).toEqual({ value: 5000, source: 'derived' });
  });

  it('2026+ 스텝의 복리 이월식 round(base×(1+rate/100))+adj 은 그대로다 — 기존 동작 보존', () => {
    // c25: adj 200 → 5200. c26: rate 5% → round(5200×1.05)=5460, adj -100 → 5360.
    const chain = buildSalaryChain(
      [step('c25', 2025), step('c26', 2026)],
      { currentSalary: 5000, previousSalary: 4800 },
      new Map([['c26', 5]]),
      new Map([
        ['c25', 200],
        ['c26', -100],
      ]),
    );
    expect(chain.currentSalary).toBe(5360);
    expect(chain.previous).toEqual({ value: 5200, source: 'derived' });
  });

  it('Compensation 인상률 스냅샷만 있는 스텝(조정분 없음)도 실데이터 스텝이다 — 기존 동작 보존', () => {
    const chain = buildSalaryChain(
      [step('c26', 2026)],
      { currentSalary: 5000, previousSalary: 4800 },
      new Map([['c26', 3]]),
      new Map(),
    );
    expect(chain.currentSalary).toBe(5150);
    expect(chain.previous).toEqual({ value: 5000, source: 'derived' });
  });

  it('사이클이 하나도 없으면 앵커 그대로(수기 전년도 표시) — 기존 동작 보존', () => {
    const chain = buildSalaryChain([], { currentSalary: 5000, previousSalary: 4800 }, new Map(), new Map());
    expect(chain.currentSalary).toBe(5000);
    expect(chain.previous).toEqual({ value: 4800, source: 'manual' });
  });
});

describe('pickAuthoritativeCyclePerYear — 연도 중복 권위 사이클 선택', () => {
  const cand = (
    id: string,
    year: number,
    cycleType: CycleType,
    status: CycleStatus,
  ): CycleCandidate => ({ id, year, cycleType, status });

  it('같은 연도의 MIDTERM 이 uuid 순서로 앞서도 FINAL 이 이긴다', () => {
    // FIX 2: 이전 구현은 id 오름차순 첫 사이클을 남겨 FINAL 의 인상·조정분이 누락될 수 있었다.
    const picked = pickAuthoritativeCyclePerYear(
      [
        cand('aaa-midterm', 2025, CycleType.MIDTERM, CycleStatus.closed),
        cand('zzz-final', 2025, CycleType.FINAL, CycleStatus.active),
      ],
      new Set(['aaa-midterm']), // Compensation 행 보유조차 FINAL 우선순위를 못 뒤집는다.
    );
    expect(picked).toEqual([{ id: 'zzz-final', year: 2025 }]);
  });

  it('cycleType 동률이면 closed 우선, 그 다음 Compensation 행 보유, 마지막으로 id 오름차순', () => {
    const closedWins = pickAuthoritativeCyclePerYear(
      [
        cand('aaa', 2025, CycleType.FINAL, CycleStatus.active),
        cand('bbb', 2025, CycleType.FINAL, CycleStatus.closed),
      ],
      new Set(),
    );
    expect(closedWins).toEqual([{ id: 'bbb', year: 2025 }]);

    const compsWins = pickAuthoritativeCyclePerYear(
      [
        cand('aaa', 2025, CycleType.FINAL, CycleStatus.closed),
        cand('bbb', 2025, CycleType.FINAL, CycleStatus.closed),
      ],
      new Set(['bbb']),
    );
    expect(compsWins).toEqual([{ id: 'bbb', year: 2025 }]);

    const idTiebreak = pickAuthoritativeCyclePerYear(
      [
        cand('bbb', 2025, CycleType.FINAL, CycleStatus.closed),
        cand('aaa', 2025, CycleType.FINAL, CycleStatus.closed),
      ],
      new Set(),
    );
    expect(idTiebreak).toEqual([{ id: 'aaa', year: 2025 }]);
  });

  it('여러 연도가 섞여도 연도 오름차순으로 연도당 1개를 반환한다', () => {
    const picked = pickAuthoritativeCyclePerYear(
      [
        cand('c26-mid', 2026, CycleType.MIDTERM, CycleStatus.active),
        cand('c25-final', 2025, CycleType.FINAL, CycleStatus.closed),
        cand('c26-final', 2026, CycleType.FINAL, CycleStatus.active),
        cand('c24-final', 2024, CycleType.FINAL, CycleStatus.closed),
      ],
      new Set(),
    );
    expect(picked).toEqual([
      { id: 'c24-final', year: 2024 },
      { id: 'c25-final', year: 2025 },
      { id: 'c26-final', year: 2026 },
    ]);
  });
});
