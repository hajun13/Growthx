-- 격리 DB 익명화 — 캡처 전에 1회 실행.
--
-- 화면에 그릴 때 가리는 게 아니라 DB 값 자체를 바꾼다. 렌더 시점 치환은 놓치는 자리가
-- 생길 수 있지만(자유 텍스트에 박힌 이름, 캔버스 렌더 등), 원본이 없으면 새어나갈 것도 없다.
--
-- 순서가 중요하다: 자유 텍스트를 먼저 치환한 뒤 users 를 바꾼다.
-- (users 를 먼저 바꾸면 원본 이름을 잃어 텍스트 안의 이름을 못 찾는다.)

BEGIN;

-- 1) 원본 → 가명 매핑. 이름 정렬 순서로 결정해 실행할 때마다 같은 결과가 나오게 한다.
CREATE TEMP TABLE name_map ON COMMIT DROP AS
WITH ordered AS (
  SELECT id, name, email, row_number() OVER (ORDER BY name, id) - 1 AS i
  FROM org.users
)
SELECT
  id,
  name AS old_name,
  email AS old_email,
  -- 성은 20명마다, 이름은 1명마다 넘긴다. (성, 이름) 쌍이 400명까지 겹치지 않는다.
  -- 두 인덱스를 같은 주기로 돌리면(예: i%20 과 (i*7)%20) 20명마다 같은 이름이 나온다.
  (ARRAY['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','전'])[((i / 20) % 20) + 1]
    || (ARRAY['민준','서연','도윤','지우','예준','하윤','주원','서윤','지호','수아','건우','지아','우진','채원','선우','다은','연우','지윤','유준','소율'])[(i % 20) + 1]
    AS new_name,
  'user' || lpad((i + 1)::text, 3, '0') || '@example.com' AS new_email
FROM ordered;

-- 2) 자유 텍스트에 박힌 이름·이메일 치환.
--    대상 컬럼은 information_schema 로 훑지 않고 명시한다 — 새 컬럼이 생겼을 때
--    조용히 빠지는 것보다, 목록을 갱신하며 의식적으로 관리하는 편이 안전하다.
DO $$
DECLARE
  cols text[][] := ARRAY[
    ARRAY['compensation','compensation_adjustments','note'],
    ARRAY['compensation','monthly_performances','cost_note'],
    ARRAY['compensation','monthly_performances','revenue_note'],
    ARRAY['competency','competency_opinions','comment'],
    ARRAY['competency','competency_responses','comment'],
    ARRAY['evaluation','comments','content'],
    ARRAY['evaluation','evaluation_review_history','reason'],
    ARRAY['evaluation','evaluations','overall_reason'],
    ARRAY['evaluation','kpi_scores','reviewer_note'],
    ARRAY['evaluation','kpi_scores','self_note'],
    ARRAY['kpi','kpis','reject_reason'],
    ARRAY['kpi','reviews','content'],
    ARRAY['midterm','action_items','completion_note'],
    ARRAY['midterm','midterm_kpi_check_ins','reviewer_note'],
    ARRAY['midterm','midterm_kpi_check_ins','self_note'],
    ARRAY['midterm','midterm_reviews','reviewer_note'],
    ARRAY['midterm','midterm_reviews','self_note'],
    ARRAY['midterm','rebaseline_requests','reason'],
    ARRAY['midterm','rebaseline_requests','review_comment'],
    ARRAY['org','users','evaluation_exempt_reason'],
    ARRAY['result','appeals','reason']
  ];
  c text[];
  m record;
BEGIN
  FOREACH c SLICE 1 IN ARRAY cols LOOP
    FOR m IN SELECT old_name, new_name, old_email, new_email FROM name_map LOOP
      EXECUTE format(
        'UPDATE %I.%I SET %I = replace(replace(%I, $1, $2), $3, $4) WHERE %I LIKE ''%%''||$1||''%%'' OR %I LIKE ''%%''||$3||''%%''',
        c[1], c[2], c[3], c[3], c[3], c[3]
      ) USING m.old_name, m.new_name, m.old_email, m.new_email;
    END LOOP;
  END LOOP;
END $$;

-- 3) 사용자 본체. 로그인 계정은 캡처 스크립트가 쓰므로 이메일을 바꾸지 않는다.
UPDATE org.users u
SET name = m.new_name,
    email = CASE WHEN u.email IN (
              'test1@energyx.co.kr', 'jsong1699@energyx.co.kr', 'test@energyx.co.kr'
            ) THEN u.email ELSE m.new_email END
FROM name_map m
WHERE u.id = m.id;

-- 4) 금액 — 실제 연봉이 화면에 남지 않게 자릿수만 유지해 흩뜨린다.
UPDATE org.users
SET current_salary = 30000000 + ((abs(hashtext(id::text)) % 40) * 1000000)
WHERE current_salary IS NOT NULL;

UPDATE compensation.compensations
SET base_salary      = CASE WHEN base_salary      IS NULL THEN NULL ELSE 30000000 + ((abs(hashtext(id::text)) % 40) * 1000000) END,
    next_year_salary = CASE WHEN next_year_salary IS NULL THEN NULL ELSE 32000000 + ((abs(hashtext(id::text)) % 40) * 1000000) END;

COMMIT;

-- 확인용 — 동명이인이 생기면 매뉴얼에서 인물이 헷갈린다. 중복이 있으면 드러나게 한다.
SELECT count(*) AS 전체, count(DISTINCT name) AS 서로다른이름 FROM org.users;
SELECT name, count(*) FROM org.users GROUP BY name HAVING count(*) > 1 ORDER BY 2 DESC LIMIT 5;
