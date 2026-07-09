/**
 * DeepSeek(외부 LLM) 설정 — env 에서만 읽는다.
 * 키가 없으면 AI 폴백이 자동 비활성되고 기존 결정론적 파서만 동작한다(폐쇄망 안전).
 */
export interface DeepseekSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

/** API 키가 설정돼 있으면 AI 폴백 활성. */
export function deepseekEnabled(): boolean {
  return !!process.env.DEEPSEEK_API_KEY?.trim();
}

/** enabled 일 때만 호출. baseUrl 후행 슬래시 제거, 기본값 보정. */
export function deepseekSettings(): DeepseekSettings {
  return {
    apiKey: (process.env.DEEPSEEK_API_KEY ?? '').trim(),
    baseUrl: (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, ''),
    model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS) || 30000,
  };
}
