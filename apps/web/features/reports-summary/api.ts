/**
 * reports-summary feature — 데이터 계층(평가자정리 표).
 * @growthx/contracts 생성 클라이언트 호출 + 봉투 unwrap(res.data.data).
 */
import { resultsControllerSummary, type SummaryRowDto } from '@growthx/contracts';

export type SummaryRow = SummaryRowDto;

export async function fetchEvaluationSummary(
  cycleId: string,
): Promise<SummaryRow[]> {
  const res = await resultsControllerSummary({ cycleId });
  return res.data.data ?? [];
}
