-- 평가지표 정합화(2026 운영계획 PPT):
--  ① 역량평가 등급 미반영(참고용) → perfCompWeights = { perf:1, comp:0 }
--  ④ 다단계 예외 상황② 가중치 추가 → stageExceptionWeights = { ex2Round1:0.7, ex2Final:0.3 }
-- 기존 rule_sets(JSON weight_policy)를 갱신해 재시드 없이 반영(2025 YoY 룰셋 포함, 무해).
UPDATE "rule_sets"
SET "weight_policy" = jsonb_set(
      jsonb_set(
        "weight_policy"::jsonb,
        '{perfCompWeights}', '{"perf":1,"comp":0}'::jsonb, true
      ),
      '{stageExceptionWeights}', '{"ex2Round1":0.7,"ex2Final":0.3}'::jsonb, true
    );
