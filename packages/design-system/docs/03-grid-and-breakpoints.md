# 03 Grid And Breakpoints

Source: Figma `Guide Board 24`, node `1:16735`.

The board defines three viewport bands and recommends flexible `fr` or CSS Grid based widths instead of fixed service widths. Height grids are intentionally not specified.

| Name | Viewport range | Columns | Offset | Gutter | Container note |
| --- | ---: | ---: | ---: | ---: | --- |
| mobile | 360px - 767px | 6 | 16px | 8px | min 360px, max 767px |
| tablet | 768px - 1199px | 8 | 24px | 24px | min 768px, max 1439px |
| desktop | 1200px+ | 12 | 24px | 24px | grid reference width 1440px |

Implementation files:

- `src/layout-tokens.mjs` exposes named breakpoint and grid tokens for application logic.
- `src/layout-tokens.d.ts` provides the TypeScript contract.
- `styles/layout.css` exposes CSS custom properties and `.ds-container` / `.ds-grid` utilities.
- `design-tokens/layout.tokens.json` keeps the handoff in design-token format.

Use named tokens or utilities for responsive layout decisions. Avoid scattering raw values such as `768`, `1200`, `24px`, or `repeat(12, ...)` in feature code.
