import type { Locator, Page } from '@playwright/test';

/**
 * 콜아웃(빨간 박스 + 번호 배지) 주입.
 *
 * 산출물이 마크다운이라 이미지 참조만 가능하므로, 오버레이를 별도 레이어로 얹지 않고
 * 캡처 직전 브라우저 DOM 에 심어 PNG 에 그대로 구워 넣는다. 좌표는 실제 요소의
 * boundingBox 에서 얻으므로 레이아웃이 바뀌어도 재캡처만으로 자동 갱신된다.
 *
 * 대상 지정은 Playwright 로케이터로 받는다 — getByRole/getByText 같은 의미 기반
 * 셀렉터를 쓸 수 있어야 클래스 해시 변경에 견딘다(앱에 data-testid 가 없음).
 */
export type Callout = {
  /** 강조할 요소. 여러 개 매칭되면 호출부에서 .first()/.nth() 로 좁힌다. */
  target: (page: Page) => Locator;
  /** 매뉴얼 설명 표에 들어갈 텍스트. `**굵게** : 설명` 형태를 권장. */
  desc: string;
  /** 박스를 요소 바깥으로 넓힐 여백 px (기본 6). */
  padding?: number;
  /** 번호 배지 위치 (기본 'left' — 참고 매뉴얼처럼 좌측 변에 걸침). */
  badge?: 'left' | 'top-left' | 'top-right';
};

/** 주입 결과 — 로케이터가 빗나간 항목을 호출부에서 경고로 노출하기 위함. */
export type AnnotateResult = {
  drawn: number[];
  missing: { index: number; desc: string; reason: string }[];
};

const OVERLAY_ID = 'gx-manual-callout-layer';

type Box = { n: number; x: number; y: number; width: number; height: number; badge: string };

export async function annotate(page: Page, callouts: Callout[]): Promise<AnnotateResult> {
  const boxes: Box[] = [];
  const missing: AnnotateResult['missing'] = [];

  for (const [i, c] of callouts.entries()) {
    const n = i + 1;
    try {
      const loc = c.target(page);
      if ((await loc.count()) === 0) {
        missing.push({ index: n, desc: c.desc, reason: '매칭 요소 없음' });
        continue;
      }
      const box = await loc.first().boundingBox();
      if (!box || box.width === 0 || box.height === 0) {
        missing.push({ index: n, desc: c.desc, reason: '요소가 화면에 렌더되지 않음' });
        continue;
      }
      const pad = c.padding ?? 6;
      boxes.push({
        n,
        x: box.x - pad,
        y: box.y - pad,
        width: box.width + pad * 2,
        height: box.height + pad * 2,
        badge: c.badge ?? 'left',
      });
    } catch (e) {
      missing.push({ index: n, desc: c.desc, reason: `로케이터 오류: ${(e as Error).message}` });
    }
  }

  await page.evaluate(
    ({ items, overlayId }) => {
      document.getElementById(overlayId)?.remove();

      const layer = document.createElement('div');
      layer.id = overlayId;
      layer.style.cssText =
        'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
      document.body.appendChild(layer);

      const RED = '#E01E1E';

      for (const it of items) {
        // boundingBox 는 뷰포트 기준 — 문서 좌표로 환산해 스크롤과 무관하게 고정한다.
        const left = it.x + window.scrollX;
        const top = it.y + window.scrollY;

        const box = document.createElement('div');
        box.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${it.width}px;height:${it.height}px;border:2px solid ${RED};border-radius:4px;box-sizing:border-box;`;
        layer.appendChild(box);

        const pos =
          it.badge === 'top-right'
            ? { l: left + it.width, t: top }
            : it.badge === 'top-left'
              ? { l: left, t: top }
              : { l: left, t: top + Math.min(16, it.height / 2) };

        // 화면 가장자리에 붙은 요소(사이드바 등)는 배지가 뷰포트 밖으로 잘린다 — 안쪽으로 당긴다.
        const cx = Math.max(pos.l, window.scrollX + 14);
        const cy = Math.max(pos.t, window.scrollY + 14);

        const badge = document.createElement('div');
        badge.textContent = String(it.n);
        badge.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;background:${RED};color:#fff;font:700 13px/22px Pretendard,system-ui,sans-serif;text-align:center;box-sizing:border-box;`;
        layer.appendChild(badge);
      }
    },
    { items: boxes, overlayId: OVERLAY_ID },
  );

  return { drawn: boxes.map((b) => b.n), missing };
}

/** 콜아웃 레이어 제거 — 같은 페이지에서 주석 없는 캡처를 이어 찍을 때 사용. */
export async function clearAnnotations(page: Page): Promise<void> {
  await page.evaluate((id) => document.getElementById(id)?.remove(), OVERLAY_ID);
}
