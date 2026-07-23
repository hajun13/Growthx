import { describe, it, expect } from 'vitest';
import { pickMidtermReviewers } from './midterm-reviewers.util';

const ME = 'me';
const DIV = 'division-head';
const DEP = 'deputy-head';
const GRP = 'group-head';

describe('pickMidtermReviewers', () => {
  it('본부장이 있으면 1차=본부장, 2차=그룹대표', () => {
    expect(
      pickMidtermReviewers({
        evaluateeId: ME,
        divisionHeadId: DIV,
        deputyHeadId: DEP,
        groupHeadId: GRP,
      }),
    ).toEqual({ firstReviewerId: DIV, finalReviewerId: GRP });
  });

  it('본부장이 없으면 부그룹장이 1차', () => {
    expect(
      pickMidtermReviewers({
        evaluateeId: ME,
        divisionHeadId: null,
        deputyHeadId: DEP,
        groupHeadId: GRP,
      }),
    ).toEqual({ firstReviewerId: DEP, finalReviewerId: GRP });
  });

  it('본부장·부그룹장이 모두 없으면 그룹대표 단독(1차=2차)', () => {
    expect(
      pickMidtermReviewers({
        evaluateeId: ME,
        divisionHeadId: null,
        deputyHeadId: null,
        groupHeadId: GRP,
      }),
    ).toEqual({ firstReviewerId: GRP, finalReviewerId: GRP });
  });

  it('본인이 본부장이면 1차 자리에서 제외되고 부그룹장으로 내려간다', () => {
    expect(
      pickMidtermReviewers({
        evaluateeId: ME,
        divisionHeadId: ME,
        deputyHeadId: DEP,
        groupHeadId: GRP,
      }),
    ).toEqual({ firstReviewerId: DEP, finalReviewerId: GRP });
  });

  it('본인이 그룹대표면 대상이 아니다(전부 null)', () => {
    expect(
      pickMidtermReviewers({
        evaluateeId: ME,
        divisionHeadId: DIV,
        deputyHeadId: DEP,
        groupHeadId: ME,
      }),
    ).toEqual({ firstReviewerId: null, finalReviewerId: null });
  });

  it('그룹대표가 없으면 대상이 아니다(전부 null)', () => {
    expect(
      pickMidtermReviewers({
        evaluateeId: ME,
        divisionHeadId: DIV,
        deputyHeadId: null,
        groupHeadId: null,
      }),
    ).toEqual({ firstReviewerId: null, finalReviewerId: null });
  });

  it('부그룹장이 그룹대표와 동일인이면 별도 1차 자리가 아니다', () => {
    expect(
      pickMidtermReviewers({
        evaluateeId: ME,
        divisionHeadId: null,
        deputyHeadId: GRP,
        groupHeadId: GRP,
      }),
    ).toEqual({ firstReviewerId: GRP, finalReviewerId: GRP });
  });
});
