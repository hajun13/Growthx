import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import { evaluateApprovalGate, approvedIdsFromTrail } from './approval-gate';

const TL = 'team-lead';
const DH = 'division-head';
const GR = 'group-rep';
const HR = 'hr-user';

const none = new Set<string>();
const approved = (...ids: string[]) => new Set(ids);

describe('evaluateApprovalGate (결재 이력 기준)', () => {
  it('현재 차례(아직 승인 안 한 가장 앞 체인 구성원)는 승인 가능(역할 무관)', () => {
    expect(evaluateApprovalGate(Role.team_lead, TL, [TL, DH], none)).toEqual({ allowed: true });
    expect(evaluateApprovalGate(Role.division_head, DH, [TL, DH], approved(TL))).toEqual({
      allowed: true,
    });
  });

  it('hr_admin 이라도 대기 결재자가 있으면 대리 불가', () => {
    // 다른 팀 round1(팀장 TL 대기)을 hr_admin 이 승인 시도 → 차단.
    expect(evaluateApprovalGate(Role.hr_admin, HR, [TL, DH], none)).toEqual({
      allowed: false,
      kind: 'hr_blocked',
    });
    // 1차 승인 후 2차(DH) 대기 중에도 대리 불가.
    expect(evaluateApprovalGate(Role.hr_admin, HR, [TL, DH], approved(TL))).toEqual({
      allowed: false,
      kind: 'hr_blocked',
    });
  });

  it('hr_admin 은 대기 결재자가 없는 경우(빈 체인)를 대리 가능', () => {
    expect(evaluateApprovalGate(Role.hr_admin, HR, [], none)).toEqual({ allowed: true });
  });

  it('hr_admin 은 체인 전원이 이미 승인한 잔여 상태(체인 축소·계층 공백)를 대리 가능', () => {
    // 체인이 [TL,DH]→[TL] 로 줄어 전원 승인 완료인데 미확정으로 남은 건 → HR 폴백.
    expect(evaluateApprovalGate(Role.hr_admin, HR, [TL], approved(TL))).toEqual({
      allowed: true,
    });
  });

  it('hr_admin 이 현재 차례의 배정 결재자 본인이면 승인 가능(자기 팀)', () => {
    // 정재훈: hr_admin + 인사총무팀장(round1 배정) → 자기 팀은 승인 가능.
    expect(evaluateApprovalGate(Role.hr_admin, TL, [TL, DH], none)).toEqual({ allowed: true });
  });

  it('결재선에 없는 비 HR 사용자는 차단(not_in_chain)', () => {
    expect(evaluateApprovalGate(Role.team_lead, 'stranger', [TL, DH], none)).toEqual({
      allowed: false,
      kind: 'not_in_chain',
    });
  });

  it('이미 승인 이력이 있는 결재자는 차단(already)', () => {
    expect(evaluateApprovalGate(Role.team_lead, TL, [TL, DH], approved(TL))).toEqual({
      allowed: false,
      kind: 'already',
    });
  });

  it('아직 차례가 아닌 뒷 단계 결재자는 차단(not_yet)', () => {
    expect(evaluateApprovalGate(Role.division_head, DH, [TL, DH], none)).toEqual({
      allowed: false,
      kind: 'not_yet',
    });
  });

  // ── 결재 도중 부서장 교체(체인 변동) 회귀 — 위치 인덱스 방식의 결함 케이스 ──

  it('부서장 교체 후에도 단계를 건너뛰지 않는다: 새 1차 부서장이 현재 차례', () => {
    // 구 팀장 A 가 1차 승인(trail=[A]) 후 팀장이 X 로 교체 → 체인 [X,DH,GR].
    // 위치 방식이면 chain[1]=DH 가 차례(1차가 X 몫인데 조용히 건너뜀) —
    // 이력 방식은 아직 승인 안 한 가장 앞 구성원 X 가 차례.
    const chain = ['new-team-lead', DH, GR];
    const trail = approved('old-team-lead');
    expect(evaluateApprovalGate(Role.team_lead, 'new-team-lead', chain, trail)).toEqual({
      allowed: true,
    });
    expect(evaluateApprovalGate(Role.division_head, DH, chain, trail)).toEqual({
      allowed: false,
      kind: 'not_yet',
    });
  });

  it('체인 재배열로 같은 사람이 두 번 승인할 수 없다(already)', () => {
    // A 가 승인(trail=[A]) 후 조직 변경으로 체인이 [B,A] 가 됨 —
    // 위치 방식이면 chain[1]=A 라 A 가 또 승인 가능했다.
    expect(evaluateApprovalGate(Role.team_lead, 'A', ['B', 'A'], approved('A'))).toEqual({
      allowed: false,
      kind: 'already',
    });
    expect(evaluateApprovalGate(Role.team_lead, 'B', ['B', 'A'], approved('A'))).toEqual({
      allowed: true,
    });
  });
});

describe('approvedIdsFromTrail', () => {
  it('trail 배열에서 approverId 집합을 추출한다', () => {
    const trail = [
      { stage: 1, approverId: TL, approverName: '팀장', at: '2026-07-07T00:00:00Z' },
      { stage: 2, approverId: DH, approverName: '본부장', at: '2026-07-08T00:00:00Z' },
    ];
    expect(approvedIdsFromTrail(trail, 2, [TL, DH, GR])).toEqual(new Set([TL, DH]));
  });

  it('이력이 있으면 legacyStage 는 무시한다(이력이 권위)', () => {
    const trail = [{ stage: 1, approverId: TL }];
    expect(approvedIdsFromTrail(trail, 3, [TL, DH, GR])).toEqual(new Set([TL]));
  });

  it('레거시 브리지: trail 없이 stage 만 백필된 행은 체인 앞 stage 명을 승인 완료로 간주', () => {
    expect(approvedIdsFromTrail(null, 1, [TL, DH, GR])).toEqual(new Set([TL]));
    expect(approvedIdsFromTrail(undefined, 2, [TL, DH, GR])).toEqual(new Set([TL, DH]));
  });

  it('trail 도 stage 도 없으면 빈 집합', () => {
    expect(approvedIdsFromTrail(null, 0, [TL, DH])).toEqual(new Set());
  });

  it('이형 항목(approverId 누락·비객체)은 무시한다', () => {
    const trail = [{ stage: 1 }, 'junk', null, { approverId: DH }];
    expect(approvedIdsFromTrail(trail, 0, [TL, DH])).toEqual(new Set([DH]));
  });
});
