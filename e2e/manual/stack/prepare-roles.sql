-- 매뉴얼 캡처용 역할 정리 — 격리 DB 에서만 실행한다.
--
-- 왜 필요한가: 데이터가 온전히 갖춰진 조직은 '테스트팀' 하나뿐인데(팀원 3명 모두
-- 확정 KPI·본인평가·중간점검 보유), 그 팀장 계정이 hr_admin 으로 만들어져 있다.
-- 실제 팀장 role 계정들은 팀원 KPI 가 확정 전이라 부서장 평가 화면이 빈 채로 찍힌다.
--
-- 그래서 이 계정의 role 만 team_lead 로 낮춘다. 부서장 배정은 role 이 아니라
-- Department.headUserId 기준이므로(B-1) 평가 체인은 그대로 유지된다.

BEGIN;

UPDATE org.users
SET role = 'team_lead',
    visibility_scope = 'team'
WHERE email = 'test@energyx.co.kr';

COMMIT;

-- 확인 — 팀장 계정과 그 팀원들의 확정 KPI 수.
SELECT u.email, u.role, u.visibility_scope,
       (SELECT count(*) FROM kpi.kpis k
         WHERE k.user_id = u.id AND k.status = 'confirmed') AS my_confirmed_kpis,
       (SELECT count(DISTINCT e.evaluatee_id) FROM evaluation.evaluations e
         WHERE e.evaluator_id = u.id AND e.type = 'downward') AS subjects
FROM org.users u
WHERE u.email IN ('test@energyx.co.kr', 'test1@energyx.co.kr');
