import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import { evaluateApprovalGate } from './approval-gate';

const TL = 'team-lead';
const DH = 'division-head';
const HR = 'hr-user';

describe('evaluateApprovalGate', () => {
  it('현재 단계 배정 결재자는 승인 가능(역할 무관)', () => {
    expect(evaluateApprovalGate(Role.team_lead, TL, [TL, DH], 0)).toEqual({ allowed: true });
    expect(evaluateApprovalGate(Role.division_head, DH, [TL, DH], 1)).toEqual({ allowed: true });
  });

  it('hr_admin 이라도 그 단계에 배정 결재자가 있으면 대리 불가', () => {
    // 다른 팀 round1(팀장 TL 배정)을 hr_admin 이 승인 시도 → 차단.
    expect(evaluateApprovalGate(Role.hr_admin, HR, [TL, DH], 0)).toEqual({
      allowed: false,
      kind: 'hr_blocked',
    });
  });

  it('hr_admin 은 배정 결재자가 없는 단계(빈 체인)를 대리 가능', () => {
    expect(evaluateApprovalGate(Role.hr_admin, HR, [], 0)).toEqual({ allowed: true });
  });

  it('hr_admin 은 체인 범위를 넘은 단계(계층 공백)를 대리 가능', () => {
    // chain=[TL] 인데 stage=1 → 배정 결재자 없음 → HR 폴백.
    expect(evaluateApprovalGate(Role.hr_admin, HR, [TL], 1)).toEqual({ allowed: true });
  });

  it('hr_admin 이 그 단계의 배정 결재자 본인이면 승인 가능(자기 팀)', () => {
    // 정재훈: hr_admin + 인사총무팀장(round1 배정) → 자기 팀은 승인 가능.
    expect(evaluateApprovalGate(Role.hr_admin, TL, [TL, DH], 0)).toEqual({ allowed: true });
  });

  it('결재선에 없는 비 HR 사용자는 차단(not_in_chain)', () => {
    expect(evaluateApprovalGate(Role.team_lead, 'stranger', [TL, DH], 0)).toEqual({
      allowed: false,
      kind: 'not_in_chain',
    });
  });

  it('이미 승인한 앞 단계 결재자는 차단(already)', () => {
    expect(evaluateApprovalGate(Role.team_lead, TL, [TL, DH], 1)).toEqual({
      allowed: false,
      kind: 'already',
    });
  });

  it('아직 차례가 아닌 뒷 단계 결재자는 차단(not_yet)', () => {
    expect(evaluateApprovalGate(Role.division_head, DH, [TL, DH], 0)).toEqual({
      allowed: false,
      kind: 'not_yet',
    });
  });
});
