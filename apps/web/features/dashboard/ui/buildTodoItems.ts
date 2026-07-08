// DashboardView 200줄 상한 분리 — "내가 확인할 항목" 카드 파생 로직만 순수 함수로 분리.
// 계산이 아니라 기존 상태 플래그(선택된 훅 데이터에서 파생)를 표시용 문구로 매핑만 한다.
// waiting = 아직 내가 할 수 있는 일이 없는 대기 상태(예: 결과 공개 전) — done(완료)과 구분.
export type TodoUrgency = 'urgent' | 'active' | 'waiting' | 'done';

// 긴급한 일이 먼저 보이도록 정렬 순서: 지금 처리 → 진행중 → 대기 → 완료.
const URGENCY_RANK: Record<TodoUrgency, number> = { urgent: 0, active: 1, waiting: 2, done: 3 };

export interface TodoItem {
  key: string;
  title: string;
  description: string;
  urgency: TodoUrgency;
  actionLabel: string;
  href: string;
}

export interface TodoFlags {
  kpiConfirmed: boolean;
  kpiStarted: boolean;
  selfDone: boolean;
  selfActive: boolean;
  isDownward: boolean;
  upperDone: boolean;
  upperStarted: boolean;
  hasResult: boolean;
}

export function buildTodoItems(flags: TodoFlags): TodoItem[] {
  const { kpiConfirmed, kpiStarted, selfDone, selfActive, isDownward, upperDone, upperStarted, hasResult } = flags;

  const items: TodoItem[] = [
    {
      key: 'kpi',
      title: kpiConfirmed ? 'KPI 작성 완료' : kpiStarted ? 'KPI 검토를 기다리는 중' : 'KPI를 작성해 주세요',
      description: kpiConfirmed
        ? '올해 KPI 작성과 검토가 모두 완료됐어요.'
        : kpiStarted
          ? '제출한 KPI가 검토 중이에요. 진행 상태를 확인하세요.'
          : '이번 평가 주기의 KPI를 아직 작성하지 않았어요.',
      urgency: (kpiConfirmed ? 'done' : kpiStarted ? 'active' : 'urgent') as TodoUrgency,
      actionLabel: kpiConfirmed ? '보기' : kpiStarted ? '진행 확인' : '작성하기',
      href: '/kpi',
    },
    {
      key: 'self-eval',
      title: selfDone ? '본인평가 제출 완료' : selfActive ? '본인평가 작성 중' : '본인평가를 시작해 주세요',
      description: selfDone
        ? '본인평가 입력을 완료했어요. 결과를 기다려주세요.'
        : selfActive
          ? '작성 중인 본인평가가 있어요. 이어서 작성해 주세요.'
          : '본인평가 입력 기간이 시작됐어요. 지금 작성할 수 있어요.',
      urgency: (selfDone ? 'done' : selfActive ? 'active' : 'urgent') as TodoUrgency,
      actionLabel: selfDone ? '보기' : selfActive ? '이어작성' : '작성하기',
      href: '/eval/self',
    },
  ];

  if (isDownward) {
    items.push({
      key: 'downward-eval',
      title: upperDone ? '구성원 평가 완료' : upperStarted ? '구성원 평가 진행 중' : '구성원 평가를 시작해 주세요',
      description: upperDone
        ? '담당 구성원 평가를 모두 제출했어요.'
        : upperStarted
          ? '일부 구성원 평가가 남아 있어요.'
          : '담당 구성원의 평가를 아직 시작하지 않았어요.',
      urgency: (upperDone ? 'done' : upperStarted ? 'active' : 'urgent') as TodoUrgency,
      actionLabel: upperDone ? '보기' : '평가하기',
      href: '/eval/dept-head',
    });
  }

  items.push({
    key: 'result',
    title: hasResult ? '평가 결과 확인 가능' : '평가 결과 공개 전',
    description: hasResult
      ? '이번 평가 주기의 결과가 공개됐어요. 지금 확인하세요.'
      : '결과가 공개되면 이 카드에서 바로 확인할 수 있어요.',
    urgency: (hasResult ? 'active' : 'waiting') as TodoUrgency,
    actionLabel: hasResult ? '결과 확인' : '',
    href: '/eval/result',
  });

  // 긴급순 정렬(urgent→active→waiting→done) — 동순위는 원래 순서 유지(Array.sort 는 stable).
  return items.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);
}
