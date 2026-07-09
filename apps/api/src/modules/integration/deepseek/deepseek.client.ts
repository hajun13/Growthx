import { Injectable, Logger } from '@nestjs/common';
import { deepseekEnabled, deepseekSettings } from '../../../common/config/deepseek.config';

/**
 * DeepSeek Chat Completions(OpenAI 호환) 얇은 클라이언트.
 * 타임아웃 + 1회 재시도. 비활성·실패 시 null 을 반환해 호출측이 파서 결과로 폴백하게 한다.
 */
@Injectable()
export class DeepseekClient {
  private readonly logger = new Logger(DeepseekClient.name);

  isEnabled(): boolean {
    return deepseekEnabled();
  }

  /** system+user 프롬프트 → JSON 응답 파싱. 실패/비활성 시 null. */
  async chatJson(system: string, user: string): Promise<unknown | null> {
    if (!this.isEnabled()) return null;
    const cfg = deepseekSettings();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
          }),
          signal: AbortSignal.timeout(cfg.timeoutMs),
        });
        if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
        const body = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = body.choices?.[0]?.message?.content;
        if (!content) throw new Error('DeepSeek 응답에 content 가 없어요.');
        return JSON.parse(content);
      } catch (e) {
        this.logger.warn(`DeepSeek 호출 실패(attempt ${attempt + 1}): ${String(e)}`);
        if (attempt === 1) return null;
      }
    }
    return null;
  }
}
