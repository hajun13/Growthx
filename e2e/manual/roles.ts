/**
 * 매뉴얼 대상 역할.
 *
 * 관리자(hr_admin) 매뉴얼은 만들지 않는다 — 실제 사용자는 구성원과 팀장이다.
 * 역할마다 보이는 화면·버튼이 다르므로 캡처도 문서도 역할별로 따로 낸다.
 */
export type RoleKey = 'employee' | 'team_lead';

export type RoleDef = {
  key: RoleKey;
  /** 문서 제목에 쓰는 이름. */
  label: string;
  /** 캡처용 계정. 실제 데이터(KPI·평가 배정)가 있는 계정이어야 화면이 빈 채로 찍히지 않는다. */
  email: string;
  password: string;
  /** 산출물 파일명(확장자 제외) — 문서와 이미지 폴더에 함께 쓴다. */
  slug: string;
  /** 문서 머리말. */
  intro: string;
};

export const ROLES: RoleDef[] = [
  {
    key: 'employee',
    label: '구성원',
    email: process.env.MANUAL_EMPLOYEE_EMAIL ?? 'test1@energyx.co.kr',
    password: process.env.MANUAL_EMPLOYEE_PASSWORD ?? '1234',
    slug: 'employee',
    intro:
      '이 문서는 **구성원** 권한으로 접속했을 때의 화면을 기준으로 작성되었습니다. ' +
      'KPI를 작성하고, 중간 점검과 본인평가를 제출하고, 확정된 결과를 확인하는 흐름을 다룹니다.',
  },
  {
    key: 'team_lead',
    label: '팀장',
    // 테스트팀 팀장. 팀원 3명이 확정 KPI·본인평가·중간점검을 모두 갖춘 유일한 조직이라
    // 이 계정을 쓴다(격리 DB 에서 prepare-roles.sql 이 role 을 team_lead 로 낮춘다).
    email: process.env.MANUAL_TEAM_LEAD_EMAIL ?? 'test@energyx.co.kr',
    password: process.env.MANUAL_TEAM_LEAD_PASSWORD ?? '1234',
    slug: 'team-lead',
    intro:
      '이 문서는 **팀장** 권한으로 접속했을 때의 화면을 기준으로 작성되었습니다. ' +
      '구성원과 동일한 본인 평가 흐름에 더해, 팀원의 KPI를 검토하고 부서장 평가를 진행하는 화면이 추가로 열립니다.',
  },
];

export const roleOf = (key: RoleKey): RoleDef => {
  const found = ROLES.find((r) => r.key === key);
  if (!found) throw new Error(`알 수 없는 역할: ${key}`);
  return found;
};
