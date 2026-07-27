import { describe, it, expect } from 'vitest';
import { deriveCareerRoster, tenureMonthsOf, totalCareerLabelOf } from './career-derivation';

/** KST 달력일을 UTC 저장 시각(자정)으로. hireDate 는 date-only 로 적재된다. */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('tenureMonthsOf — 근속력(월)', () => {
  it('채운 달력 개월수만 센다(일자 미달이면 내림)', () => {
    // 김병민 프로: 2025-12-09 입사, 2026-07-27 조회 → 7개월 18일 = 7.
    // 이전 구현(연도말 기준 + 30일 근사)은 13 이었다.
    expect(tenureMonthsOf(d('2025-12-09'), d('2026-07-27'))).toBe(7);
    expect(tenureMonthsOf(d('2025-12-09'), d('2026-12-08'))).toBe(11);
    expect(tenureMonthsOf(d('2025-12-09'), d('2026-12-09'))).toBe(12);
  });

  it('장기 근속도 30일 근사 없이 정확하다', () => {
    // 2007-09-01 → 2026-12-31 = 19년 3개월 30일 = 231개월(이전 구현은 30일 근사로 235).
    expect(tenureMonthsOf(d('2007-09-01'), d('2026-12-31'))).toBe(231);
    expect(tenureMonthsOf(d('2007-09-01'), d('2026-07-27'))).toBe(226);
  });

  it('기준일이 그 달 말일이면 일자가 모자라도 채운 달로 인정', () => {
    expect(tenureMonthsOf(d('2025-01-31'), d('2025-02-28'))).toBe(1);
    expect(tenureMonthsOf(d('2025-01-31'), d('2025-03-30'))).toBe(1);
    expect(tenureMonthsOf(d('2025-01-31'), d('2025-03-31'))).toBe(2);
  });

  it('입사 예정(미래 입사일)은 음수가 아니라 0', () => {
    expect(tenureMonthsOf(d('2026-09-01'), d('2026-07-27'))).toBe(0);
  });

  it('입사일 없으면 null', () => {
    expect(tenureMonthsOf(null, d('2026-07-27'))).toBeNull();
  });

  it('KST 달력일로 판정한다(UTC 로 하루 앞당겨지지 않음)', () => {
    // 2026-07-08 23:00 KST = 2026-07-08T14:00Z. 07-09 입사 하루 전이므로 아직 11개월.
    expect(tenureMonthsOf(d('2025-08-09'), new Date('2026-07-08T14:00:00.000Z'))).toBe(10);
    // 2026-07-09 00:30 KST = 2026-07-08T15:30Z → 입사 응당일이므로 11개월.
    expect(tenureMonthsOf(d('2025-08-09'), new Date('2026-07-08T15:30:00.000Z'))).toBe(11);
  });
});

describe('deriveCareerRoster — 총경력', () => {
  it('총경력 = 근속 + 전경력, 라벨은 N년 M개월', () => {
    const out = deriveCareerRoster(
      {
        hireDate: d('2025-12-09'),
        priorCareerMonths: 26,
        careerBaseMonths: 0,
        careerPosition: null,
        serviceYears: 1,
        considerationExclusion: null,
        currentSalary: null,
        currentSalaryExclTransfer: null,
      },
      d('2026-07-27'),
    );
    expect(out.tenureMonths).toBe(7);
    expect(out.totalCareerMonths).toBe(33);
    expect(out.totalCareerLabel).toBe('2년 9개월');
  });

  it('입사일 없고 전경력만 있으면 전경력이 총경력', () => {
    const out = deriveCareerRoster(
      {
        hireDate: null,
        priorCareerMonths: 40,
        careerBaseMonths: null,
        careerPosition: null,
        serviceYears: null,
        considerationExclusion: null,
        currentSalary: null,
        currentSalaryExclTransfer: null,
      },
      d('2026-07-27'),
    );
    expect(out.tenureMonths).toBeNull();
    expect(out.totalCareerMonths).toBe(40);
    expect(totalCareerLabelOf(out.totalCareerMonths)).toBe('3년 4개월');
  });
});
