# 16 Tooltip

Source: Figma node `1:29249`, board title `툴팁`.

Tooltips provide short supplementary information when a user hovers, focuses, or explicitly opens the trigger. The Figma board shows a question-mark trigger icon and a bubble anchored to one of four corners.

## Figma Rules

| Rule | Value |
| --- | --- |
| Placements | `bottom-start`, `bottom-end`, `top-start`, `top-end` |
| Trigger | `20px` icon button |
| Bubble width | Designed per screen, default example `272px`, max `328px` |
| Bubble padding | `16px` |
| Bubble radius | `8px` |
| Trigger-to-bubble gap | `4px` |
| Text | Pretendard Regular `12px/18px` |
| Dark tone | `#000000` background, `#FFFFFF` text |
| Light tone | `#FFFFFF` background, `#000000` text for inverse surfaces |
| Elevation | `0 8px 16px rgb(0 0 0 / 12%)` |
| Arrow | Figma board has no triangular arrow; API supports optional arrow when product usage requires it. |

The Korean board copy says the tooltip appears on click or mouse hover and disappears when the mouse leaves. In implementation, focus must also open it so keyboard users receive the same information.

## CSS API

```html
<span class="ds-tooltip ds-tooltip--bottom-start ds-tooltip--dark">
  <button class="ds-tooltip__trigger" type="button" aria-describedby="plan-tip">?</button>
  <span class="ds-tooltip__bubble" id="plan-tip" role="tooltip">tooltip here</span>
</span>
```

Use `data-open="true"` for controlled click state:

```html
<span class="ds-tooltip ds-tooltip--top-end ds-tooltip--dark" data-open="true">
  <button class="ds-tooltip__trigger" type="button" aria-describedby="status-tip">?</button>
  <span class="ds-tooltip__bubble" id="status-tip" role="tooltip">Up to 328px wide.</span>
</span>
```

## React-Friendly Props

```ts
type TooltipProps = {
  id: string;
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  tone?: "dark" | "light";
  arrow?: boolean;
  open?: boolean;
  showDelay?: number;
  hideDelay?: number;
};
```

Recommended behavior:

- Open on hover and focus by default.
- Support controlled click state with `open` and `data-open`.
- Keep non-interactive content as `role="tooltip"` and wire the trigger with `aria-describedby`.
- Use `role="dialog"`, `aria-haspopup="dialog"`, and `aria-expanded` only when the layer contains focusable controls; then manage focus explicitly.
- Render the bubble in a layer that can escape clipped containers in app frameworks. The CSS uses `position: absolute` and `z-index: 1000`; portal-based implementations should preserve the same placement values.
- Keep long copy wrapped and capped at `328px`.

## Implementation

- Token source: `design-tokens/tooltip.tokens.json`
- CSS variables and classes: `styles/tooltip.css`
- Runtime helpers and type declarations: `src/tooltip.mjs`, `src/tooltip.d.ts`
