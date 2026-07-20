import type { Page } from '@playwright/test';
import type { Callout } from './annotate';
import type { RoleKey } from './roles';

/**
 * 매뉴얼 캡처 대상 화면 카탈로그.
 *
 * 관리자(hr_admin) 전용 화면은 담지 않는다 — 매뉴얼 독자는 구성원과 팀장이다.
 * 한 화면이 두 역할 모두에 열리면 `roles` 에 둘 다 적는다. 같은 경로라도 역할에 따라
 * 보이는 내용이 다르므로 캡처는 역할별로 따로 찍힌다.
 */
export type Screen = {
  /** 파일명·앵커에 쓰는 키. */
  key: string;
  /** 이 화면이 들어갈 역할 매뉴얼. */
  roles: RoleKey[];
  /** 매뉴얼 제목. */
  title: string;
  /** 회색 경로 표기 (예: `인사평가 > KPI 작성`). */
  breadcrumb: string;
  /** 접근 경로. */
  path: string;
  /** 제목 아래 본문 설명. */
  desc: string;
  /** 캡처 전 조작 (탭 전환, 모달 열기 등). */
  setup?: (page: Page) => Promise<void>;
  /** 이 셀렉터가 보일 때까지 대기 — 페이지별 로딩 완료 신호. */
  waitFor?: string;
  /** 번호 콜아웃. 정의 순서가 그대로 ①②③ 번호가 된다. */
  callouts?: Callout[];
};

// ─── 조작 헬퍼 ─────────────────────────────────────────────────────────

/**
 * 탭 라벨로 전환. role=tab 인 탭과 버튼형 탭을 모두 처리하고,
 * 둘 다 없으면 조용히 넘어간다 — 역할에 따라 탭이 아예 없는 화면이 있다
 * (예: 구성원의 중간 점검은 '구성원 점검·평가' 탭이 없어 단일 화면으로 뜬다).
 */
export const clickTab = (name: string) => async (page: Page) => {
  const tab = page.getByRole('tab', { name }).first();
  const btn = page.getByRole('button', { name, exact: false }).first();
  const target = (await tab.count()) ? tab : (await btn.count()) ? btn : null;
  if (!target) return;
  await target.click();
  await page.waitForTimeout(700);
};

/** 버튼을 눌러 모달을 연다. 대상이 없으면 조용히 넘어간다(역할에 따라 없을 수 있음). */
export const openModal = (name: string) => async (page: Page) => {
  const btn = page.getByRole('button', { name, exact: false }).first();
  if (!(await btn.count())) return;
  await btn.click();
  await page.waitForTimeout(800);
};

// ─── 콜아웃 로케이터 헬퍼 ───────────────────────────────────────────────
// 앱에 data-testid 가 없어 화면의 한글 텍스트와 구조 클래스를 앵커로 쓴다.
// (Card 는 루트에 `gx-work-surface`, master-detail 은 `gx-master-detail`)

const heading = (p: Page) => p.locator('h1').first();
const tabs = (p: Page) => p.locator('[role="tablist"]').first();
const table = (p: Page) => p.locator('table').first();
const sidebar = (p: Page) => p.locator('aside').first();
const dialog = (p: Page) => p.locator('[role="dialog"]').first();
const masterPanel = (p: Page) => p.locator('.gx-master-detail > *').first();
const card = (title: string) => (p: Page) =>
  p.locator('.gx-work-surface').filter({ hasText: title }).first();
const section = (title: string) => (p: Page) =>
  p.locator('section').filter({ hasText: title }).first();
const gridRow = (title: string) => (p: Page) =>
  p.locator('div.grid').filter({ hasText: title }).first();
const button = (name: string) => (p: Page) =>
  p.getByRole('button', { name, exact: false }).first();
const text = (t: string) => (p: Page) => p.getByText(t, { exact: false }).first();
const input = (placeholder: string) => (p: Page) =>
  p.getByPlaceholder(placeholder, { exact: false }).first();

const BOTH: RoleKey[] = ['employee', 'team_lead'];
const LEAD: RoleKey[] = ['team_lead'];

export const SCREENS: Screen[] = [
  // ── 공통 ──────────────────────────────────────────────────────────
  {
    key: 'dashboard',
    roles: BOTH,
    title: '대시보드',
    breadcrumb: '대시보드',
    path: '/dashboard',
    desc: '로그인 후 처음 만나는 화면입니다. 지금 처리해야 할 일, 평가 진행 상황, 최근 알림을 한눈에 확인합니다.',
    callouts: [
      { target: sidebar, desc: '**전체 메뉴** : 인사평가·모니터링 등으로 묶인 메뉴입니다. 좌측 상단 아이콘으로 접을 수 있습니다.' },
      { target: gridRow('현재 주기'), desc: '**요약 타일** : 현재 평가 주기, 전체 완료율, 마감까지 남은 기간, 결과 공개 예정일입니다.' },
      { target: section('내가 확인할 항목'), desc: '**내가 확인할 항목** : 지금 처리해야 할 일이 카드로 표시됩니다. 버튼을 누르면 해당 화면으로 바로 이동합니다.' },
      { target: section('평가 진행 단계'), desc: '**평가 진행 단계** : KPI 작성 → 본인평가 → 상위평가 → 조정/검토 → 결과공개 중 현재 위치입니다.' },
      { target: gridRow('평가 일정'), desc: '**평가 일정 · 최근 알림 · 조직 진행 현황** : 단계별 마감일과 최근 알림, 소속 조직의 진행률입니다.' },
    ],
  },
  {
    key: 'kpi',
    roles: BOTH,
    title: 'KPI 작성',
    breadcrumb: '인사평가 > KPI 작성',
    path: '/kpi',
    desc: '연초에 본인의 KPI(성과 목표)를 작성해 상급자에게 제출합니다. 가중치 합계가 100%가 되어야 제출할 수 있습니다.',
    callouts: [
      { target: heading, desc: '**KPI 작성** : 올해 본인의 성과 목표를 등록하는 화면입니다.' },
      { target: text('가중치'), desc: '**가중치** : 과제별 비중입니다. 전체 합계가 100%가 되어야 제출할 수 있습니다.' },
    ],
  },
  {
    key: 'eval-self',
    roles: BOTH,
    title: '본인평가',
    breadcrumb: '인사평가 > 본인평가',
    path: '/eval/self',
    desc: '확정된 KPI에 대해 본인의 실적과 등급을 입력해 제출합니다. 평가 기간(최종평가 일정) 안에서만 작성할 수 있습니다.',
    // 아직 시작 전이면 빈 안내만 찍힌다. 실제 입력 폼을 담으려고 한 번 시작시킨다
    // (격리 DB 는 버려질 사본이라 이런 조작이 안전하다).
    setup: openModal('본인평가 시작하기'),
    callouts: [
      { target: heading, desc: '**본인평가** : 확정된 KPI에 대해 실적과 등급을 입력합니다.' },
      { target: text('가중치'), desc: '**과제별 카드** : 확정된 KPI가 순서대로 표시되고, 각 카드에서 실적과 등급(S~D)을 선택합니다.' },
    ],
  },
  {
    key: 'eval-midterm',
    roles: BOTH,
    title: '중간 점검 — 내 중간 점검',
    breadcrumb: '인사평가 > 중간 점검',
    path: '/eval/midterm',
    desc: '연중 목표 진척을 스스로 점검해 제출합니다. 등급·보상에는 반영되지 않는 참고 절차입니다.',
    setup: clickTab('내 중간 점검'),
    // 탭은 팀장에게만 나오므로 콜아웃으로 잡지 않는다(구성원 화면에선 매칭 실패한다).
    callouts: [
      { target: heading, desc: '**중간 점검** : 연중 목표 진척을 스스로 점검해 제출하는 화면입니다.' },
      { target: card('상반기 총평'), desc: '**총평** : 상반기 진행 상황을 서술로 남깁니다. [총평 저장]으로 임시 저장됩니다.' },
    ],
  },
  {
    key: 'competency-eval',
    roles: ['employee'],
    title: '역량평가',
    breadcrumb: '인사평가 > 역량평가',
    path: '/competency/eval',
    desc:
      '본인의 역량을 5점 척도로 평가합니다. 엑셀 역량평가서와 같은 표 형식이며, 평가자 열은 평가가 끝난 뒤에 공개됩니다. ' +
      '역량평가 결과는 참고용으로, 연봉·최종등급에는 반영되지 않습니다. 조정/검토 단계부터 열립니다.',
    callouts: [
      { target: text('피평가자'), desc: '**평가선** : 나를 평가하는 1차·2차·최종 평가자와, 내가 입력하는 열을 표시합니다.' },
      { target: text('[평가가이드]'), desc: '**평가가이드** : 5점(매우 그렇다) ~ 1점(전혀 그렇지 않다) 척도 기준입니다.' },
      { target: table, desc: '**평가표** : 지표·가중치·행동지표와 점수 열입니다. [본인평가] 열만 입력할 수 있고, 평가자 열은 자물쇠로 가려집니다.' },
      { target: text('[종합의견]'), desc: '**종합의견 · 평가점수 환산** : 평가자가 남긴 의견과 환산 점수로, 평가가 완료된 뒤 공개됩니다.' },
    ],
  },
  {
    key: 'competency-eval-lead',
    roles: LEAD,
    title: '역량평가',
    breadcrumb: '인사평가 > 역량평가',
    path: '/competency/eval',
    desc:
      '본인과 팀원의 역량을 5점 척도로 평가합니다. 엑셀 역량평가서와 같은 표 형식으로 본인·1차·2차·최종 평가자 열이 나란히 표시됩니다. ' +
      '역량평가 결과는 참고용으로, 연봉·최종등급에는 반영되지 않습니다. 조정/검토 단계부터 열립니다.',
    callouts: [
      { target: masterPanel, desc: '**평가 대상** : 본인 평가표와 평가할 팀원 목록입니다. 미작성·작성중·제출완료로 필터할 수 있습니다.' },
      { target: text('피평가자'), desc: '**평가선** : 피평가자와 1차·2차·최종 평가자, 내가 입력하는 열을 표시합니다.' },
      { target: text('[평가가이드]'), desc: '**평가가이드** : 5점(매우 그렇다) ~ 1점(전혀 그렇지 않다) 척도 기준입니다.' },
      { target: table, desc: '**평가표** : 지표·가중치·행동지표와 평가자별 점수 열입니다. 본인 차례의 열만 입력할 수 있습니다.' },
      { target: text('[종합의견]'), desc: '**종합의견 · 평가점수 환산** : 단계별 종합의견을 남기고, 평가자 점수가 1차 50% · 2차 30% · 최종 20%로 환산됩니다. 본인평가 점수는 환산에 반영되지 않습니다.' },
    ],
  },
  {
    key: 'eval-my',
    roles: BOTH,
    title: '내 평가표',
    breadcrumb: '인사평가 > 내 평가표',
    path: '/eval/my',
    desc: '본인의 평가 진행 상황과 확정된 평가 결과를 확인합니다. 결과는 조정/검토가 끝나 주기가 마감된 뒤 공개됩니다.',
    callouts: [
      { target: card('평가 결과 요약'), desc: '**평가 결과 요약** : 종합평가 등급·점수와 영역별 등급, 전사 평균입니다.' },
      { target: text('상세 평가표 보기'), desc: '**상세 보기** : 과제별 점수와 평가자 코멘트가 담긴 상세 평가표로 이동합니다.' },
      { target: card('평가 진행 현황'), desc: '**평가 진행 현황** : 본인평가 → 1차 → 2차 → 최종 → 확정 단계의 진행 상태와 단계별 등급입니다.' },
    ],
  },
  {
    key: 'appeals',
    roles: BOTH,
    title: '이의제기',
    breadcrumb: '모니터링 > 이의제기',
    path: '/appeals',
    desc: '확정된 평가 결과에 이의가 있으면 신청하고 처리 경과를 확인합니다.',
    callouts: [
      { target: heading, desc: '**이의제기** : 확정된 결과에 대한 이의를 신청하고 진행 상태를 확인합니다.' },
      { target: text('접수'), desc: '**상태** : 접수 → 답변완료 → 최종완료 순으로 진행됩니다.' },
    ],
  },
  {
    key: 'notifications',
    roles: BOTH,
    title: '알림함',
    breadcrumb: '헤더 > 알림 > 전체 보기',
    path: '/notifications',
    desc: '받은 알림을 유형별로 모아 봅니다. 헤더의 알림 아이콘에서 [전체 보기]로 이동합니다.',
    callouts: [
      { target: tabs, desc: '**유형 탭** : 전체·안읽음·일정·KPI·결과·이의제기로 알림을 분류합니다.' },
      { target: button('모두 읽음'), desc: '**모두 읽음** : 안읽은 알림을 한 번에 읽음 처리합니다.' },
    ],
  },
  {
    key: 'settings',
    roles: BOTH,
    title: '설정 — 알림',
    breadcrumb: '기타 > 설정',
    path: '/admin/settings',
    desc: '받을 알림 종류를 켜고 끕니다.',
    setup: clickTab('알림 설정'),
    callouts: [
      { target: button('알림 설정'), desc: '**탭 전환** : 알림 설정과 비밀번호 변경으로 나뉩니다.' },
      { target: card('알림 설정'), desc: '**알림 설정** : 받을 알림 종류를 선택합니다.' },
    ],
  },
  {
    key: 'settings-password',
    roles: BOTH,
    title: '설정 — 비밀번호 변경',
    breadcrumb: '기타 > 설정 > 비밀번호 변경',
    path: '/admin/settings',
    desc: '로그인 비밀번호를 변경합니다.',
    setup: clickTab('비밀번호 변경'),
    callouts: [
      { target: button('비밀번호 변경'), desc: '**탭 전환** : [비밀번호 변경] 탭을 선택합니다.' },
    ],
  },
  {
    key: 'org',
    roles: BOTH,
    title: '조직도',
    breadcrumb: '직접 이동 (/org)',
    path: '/org',
    desc: '그룹 → 본부 → 팀 → 개인의 4단계 조직 구조를 확인합니다.',
    callouts: [
      { target: card('조직 현황'), desc: '**조직 현황** : 그룹·본부·팀 수와 재직 인원 요약입니다.' },
    ],
  },

  // ── 팀장 전용 ──────────────────────────────────────────────────────
  {
    key: 'kpi-review',
    roles: LEAD,
    title: 'KPI 검토',
    breadcrumb: '인사평가 > KPI 검토',
    path: '/kpi/review',
    desc: '팀원이 제출한 KPI를 결재선(1차 팀장 → 2차 본부장 → 최종 그룹대표) 순서대로 승인하거나 반려합니다.',
    callouts: [
      { target: heading, desc: '**KPI 검토** : 팀원이 제출한 KPI를 결재선 순서대로 처리합니다.' },
      { target: text('결재'), desc: '**결재 상태** : 작성중 / 결재 대기 / 확정으로 구분됩니다. 승인 버튼은 본인 차례일 때만 나타납니다.' },
    ],
  },
  {
    key: 'kpi-review-reject',
    roles: LEAD,
    title: 'KPI 검토 — 반려하기',
    breadcrumb: '인사평가 > KPI 검토 > 반려',
    path: '/kpi/review',
    desc:
      '보완이 필요하면 반려합니다. 사유를 적어 보내면 작성자에게 알림이 가고 KPI가 작성중 상태로 돌아갑니다. ' +
      '반려는 결재선에 속한 사람이면 하위 단계가 승인한 뒤에도 할 수 있습니다.',
    // 결재 대기 중인 대상을 고른 뒤 반려 버튼을 눌러야 모달이 열린다.
    setup: async (page: Page) => {
      // 결재 대기 중인 대상을 고르면 그때서야 승인·반려 버튼이 나타난다.
      await page.getByText('결재 대기').first().click();
      // '반려' 는 exact 로 잡는다 — 부분 일치면 '반려 사유' 같은 다른 노드에 먼저 걸린다.
      const reject = page.getByRole('button', { name: '반려', exact: true }).first();
      await reject.waitFor({ state: 'visible', timeout: 10_000 });
      await reject.click();
      await page.waitForTimeout(700);
    },
    waitFor: '[role="dialog"]',
    callouts: [
      { target: dialog, desc: '**반려 사유** : 무엇을 보완해야 하는지 적어 보냅니다. 작성자에게 알림으로 전달됩니다.' },
    ],
  },
  {
    key: 'eval-dept-head',
    roles: LEAD,
    title: '부서장 평가',
    breadcrumb: '인사평가 > 부서장 평가',
    path: '/eval/dept-head',
    desc: '배정된 팀원을 평가합니다. 1차·2차·최종 평가자의 점수가 50%·30%·20% 가중으로 결합됩니다.',
    callouts: [
      { target: masterPanel, desc: '**대상 목록** : 내가 평가할 팀원입니다. 상태로 필터할 수 있고, 제출하면 다음 대상으로 자동 이동합니다.' },
      { target: text('가중치'), desc: '**과제별 평가** : 팀원이 제출한 실적을 보고 과제별 등급을 입력합니다.' },
    ],
  },
  {
    key: 'eval-midterm-members',
    roles: LEAD,
    title: '중간 점검 — 구성원 점검·평가',
    breadcrumb: '인사평가 > 중간 점검 > 구성원 점검·평가',
    path: '/eval/midterm',
    desc: '팀원이 제출한 자가점검을 확인하고 의견을 남기거나 반송합니다. 확인은 결재선 순서대로 진행됩니다.',
    setup: clickTab('구성원 점검·평가'),
    callouts: [
      { target: tabs, desc: '**탭 전환** : [구성원 점검·평가] 탭입니다. 숫자 배지는 처리 대기 건수입니다.' },
    ],
  },
  {
    key: 'eval-midterm-rebaseline',
    roles: LEAD,
    title: '중간 점검 — 재조정 검토',
    breadcrumb: '인사평가 > 중간 점검 > 재조정 검토',
    path: '/eval/midterm',
    desc: '팀원이 신청한 목표 재조정을 검토해 승인하거나 반려합니다.',
    setup: clickTab('재조정 검토'),
    callouts: [
      { target: tabs, desc: '**탭 전환** : [재조정 검토] 탭입니다.' },
    ],
  },
  {
    key: 'eval-result',
    roles: LEAD,
    title: '평가결과',
    breadcrumb: '인사평가 > 평가결과',
    path: '/eval/result',
    desc: '팀원의 평가 결과를 확인합니다. 행을 클릭하면 개인별 상세 평가표로 이동합니다.',
    callouts: [
      { target: card('등급 분포'), desc: '**등급 분포** : 조회 범위의 S~D 인원과 비율입니다.' },
      { target: card('대상자'), desc: '**결과 목록** : 대상자별 최종점수·등급·평가 상태입니다.' },
    ],
  },
  {
    key: 'reports',
    roles: LEAD,
    title: '분포 모니터링',
    breadcrumb: '모니터링 > 분포 모니터링',
    path: '/reports',
    desc: '조직별 등급 분포를 모니터링합니다.',
    callouts: [
      { target: button('분포 모니터링'), desc: '**탭 전환** : 분포 모니터링과 월별 실적을 전환합니다.' },
      { target: card('부서별 등급 분포'), desc: '**부서별 등급 분포** : 부서별 인원과 S/A/B/C/D 비중입니다.' },
    ],
  },
  {
    key: 'reports-evaluation-summary',
    roles: LEAD,
    title: '평가 결과표',
    breadcrumb: '실적관리 > 평가 결과표',
    path: '/reports/evaluation-summary',
    desc: '팀원의 평가 진행 상태와 최종점수·등급을 한 표로 확인합니다.',
    callouts: [
      { target: table, desc: '**평가 결과표** : 대상자별 소속·직급·평가 상태·최종점수·최종등급입니다.' },
    ],
  },
];
