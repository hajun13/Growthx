import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import { evaluateMidtermTurn } from './midterm-turn';

const ME = 'employee';
const FIRST = 'division-head';
const FINAL = 'group-head';
const HR = 'hr-user';

const base = {
  evaluateeId: ME,
  firstReviewerId: FIRST,
  finalReviewerId: FINAL,
};

describe('evaluateMidtermTurn', () => {
  it('pending 에서 1차 평가자만 코멘트할 수 있다', () => {
    expect(
      evaluateMidtermTurn({ ...base, action: 'comment', status: 'pending', userId: FIRST, role: Role.division_head }),
    ).toEqual({ allowed: true });
    expect(
      evaluateMidtermTurn({ ...base, action: 'comment', status: 'pending', userId: FINAL, role: Role.division_head }),
    ).toEqual({ allowed: false, kind: 'not_your_turn' });
  });

  it('commented 에서 피평가자 본인만 수정 제출할 수 있다', () => {
    expect(
      evaluateMidtermTurn({ ...base, action: 'revise', status: 'commented', userId: ME, role: Role.employee }),
    ).toEqual({ allowed: true });
    expect(
      evaluateMidtermTurn({ ...base, action: 'revise', status: 'commented', userId: FIRST, role: Role.division_head }),
    ).toEqual({ allowed: false, kind: 'not_in_chain' });
  });

  it('returned 에서도 피평가자가 재수정할 수 있다', () => {
    expect(
      evaluateMidtermTurn({ ...base, action: 'revise', status: 'returned', userId: ME, role: Role.employee }),
    ).toEqual({ allowed: true });
  });

  it('1차 코멘트 전에는 수정 제출이 불가하다', () => {
    expect(
      evaluateMidtermTurn({ ...base, action: 'revise', status: 'pending', userId: ME, role: Role.employee }),
    ).toEqual({ allowed: false, kind: 'wrong_status' });
  });

  it('revised 에서 2차 검토자만 승인·반려할 수 있다', () => {
    expect(
      evaluateMidtermTurn({ ...base, action: 'decide', status: 'revised', userId: FINAL, role: Role.division_head }),
    ).toEqual({ allowed: true });
    expect(
      evaluateMidtermTurn({ ...base, action: 'decide', status: 'revised', userId: FIRST, role: Role.division_head }),
    ).toEqual({ allowed: false, kind: 'not_your_turn' });
  });

  it('1차·2차 동일인(단계 압축)이면 같은 사람이 코멘트와 판정을 모두 한다', () => {
    const solo = { evaluateeId: ME, firstReviewerId: FINAL, finalReviewerId: FINAL };
    expect(
      evaluateMidtermTurn({ ...solo, action: 'comment', status: 'pending', userId: FINAL, role: Role.division_head }),
    ).toEqual({ allowed: true });
    expect(
      evaluateMidtermTurn({ ...solo, action: 'decide', status: 'revised', userId: FINAL, role: Role.division_head }),
    ).toEqual({ allowed: true });
  });

  it('hr_admin 은 대리 수행할 수 있다', () => {
    expect(
      evaluateMidtermTurn({ ...base, action: 'comment', status: 'pending', userId: HR, role: Role.hr_admin }),
    ).toEqual({ allowed: true });
    expect(
      evaluateMidtermTurn({ ...base, action: 'decide', status: 'revised', userId: HR, role: Role.hr_admin }),
    ).toEqual({ allowed: true });
  });

  it('reopen 은 closed 상태에서 hr_admin 만 가능하다', () => {
    expect(
      evaluateMidtermTurn({ ...base, action: 'reopen', status: 'closed', userId: HR, role: Role.hr_admin }),
    ).toEqual({ allowed: true });
    expect(
      evaluateMidtermTurn({ ...base, action: 'reopen', status: 'closed', userId: FINAL, role: Role.division_head }),
    ).toEqual({ allowed: false, kind: 'hr_only' });
    expect(
      evaluateMidtermTurn({ ...base, action: 'reopen', status: 'revised', userId: HR, role: Role.hr_admin }),
    ).toEqual({ allowed: false, kind: 'wrong_status' });
  });

  it('closed 상태에서는 코멘트·수정·판정이 모두 막힌다', () => {
    for (const action of ['comment', 'revise', 'decide'] as const) {
      expect(
        evaluateMidtermTurn({ ...base, action, status: 'closed', userId: HR, role: Role.hr_admin }).allowed,
      ).toBe(false);
    }
  });
});
