# 14 Toast

Source: Figma node `1:28629`, board title `토스트(스낵바)`.

Toasts provide temporary feedback after a user action. The board recommends short messages, fade in/out motion, and normal status as the default.

## Figma Rules

| Rule | Value |
| --- | --- |
| Status | `normal`, `warn`, `error`, `pass` |
| Line | `single`, `double` |
| Action | `none`, `normal`, `longer` |
| Default | `normal`, `single`, `action: none` |
| Width | Desktop/tablet fixed `344px`; mobile fills available device width |
| Heights | `48px` single, `68px` double, `96px` longer action |
| Duration | `2000ms` before dismiss |
| Motion | Fade in/fade out |
| Desktop placement | Fixed top center |
| Tablet/mobile placement | Fixed bottom center |
| Bottom bar rule | Move upward by bottom-bar height when a bottom bar exists |
| Layering | Above header, bottom bar, and FAB |
| Elevation | `elevation3`: `0 8px 16px rgb(0 0 0 / 12%)` |
| Text | Pretendard Regular `12px/18px` |
| Action text | Pretendard Medium `13px/20px` |

Status usage from the board:

| Status | Use |
| --- | --- |
| `normal` | General messages. Prefer this for most snackbars. |
| `warn` | Important cautions or extra care before/after an action. |
| `error` | User action failed or produced an error. |
| `pass` | User action completed successfully. |

The Figma component exposes `contents`, `line`, and `action_button`. In code these map to `status`, `line`, and `action`. The board examples use a colored rail rather than a required status icon; `icon` and `close` are optional API flags for product cases that need them.

## CSS API

Render the viewport through a portal near the document root so it can escape clipped containers:

```html
<div class="ds-toast-viewport ds-toast-viewport--top-center ds-toast-viewport--desktop">
  <div class="ds-toast ds-toast--normal ds-toast--single ds-toast--action-none ds-toast--top-center ds-toast--open" role="status" aria-live="polite" aria-atomic="true">
    <span class="ds-toast__rail" aria-hidden="true"></span>
    <span class="ds-toast__message">message here</span>
  </div>
</div>
```

For tablet/mobile placement:

```html
<div class="ds-toast-viewport ds-toast-viewport--bottom-center ds-toast-viewport--mobile ds-toast-viewport--with-bottom-bar">
  <div class="ds-toast ds-toast--pass ds-toast--double ds-toast--action-normal ds-toast--bottom-center ds-toast--open" role="status" aria-live="polite" aria-atomic="true">
    <span class="ds-toast__rail" aria-hidden="true"></span>
    <span class="ds-toast__message">message here</span>
    <button class="ds-toast__action" type="button">Action</button>
  </div>
</div>
```

## React-Friendly Props

```ts
type ToastProps = {
  id?: string;
  message: React.ReactNode;
  status?: "normal" | "warn" | "error" | "pass";
  line?: "single" | "double";
  action?: { label: string; onClick: () => void; variant?: "normal" | "longer" };
  icon?: boolean;
  close?: boolean;
  placement?: "top-center" | "bottom-center";
  viewport?: "desktop" | "tablet" | "mobile";
  duration?: number;
  open?: boolean;
};
```

Recommended behavior:

- Default to `duration: 2000` and auto-dismiss after the fade-in period.
- Use `role="status"` and `aria-live="polite"` for `normal`, `warn`, and `pass`.
- Use `role="alert"` and `aria-live="assertive"` for `error`.
- Keep `aria-atomic="true"` so the whole message is announced.
- Pause dismissal while keyboard focus or pointer hover is inside a toast with an action or close button.
- Render the viewport in a portal/layer above header, bottom bar, and FAB. CSS uses `z-index: 1200`.
- Avoid long copy. Use `double` only when the message naturally wraps to two lines; use `longer` when action text/layout needs a second row.

## Implementation

- Token source: `design-tokens/toast.tokens.json`
- CSS variables and classes: `styles/toast.css`
- Runtime helpers and type declarations: `src/toast.mjs`, `src/toast.d.ts`
