# 06 Icon and Image

Source: Figma node `1:17010`, board title `아이콘과 이미지 취급`.

The board separates assets by naming and delivery intent rather than by visual complexity alone. Icons use the `ic_` prefix, are fontized in product, and are handed off to development as SVG. Images use the `img_` prefix for fixed-color, duotone, brand, pictogram, or otherwise image-like assets.

## Core Rules

| Rule | Value | Implementation |
| --- | --- | --- |
| Design grid | `24x24` | `asset.grid.base`, `--asset-grid-base` |
| Common display size | `48x48` | `asset.grid.display`, `--asset-grid-display` |
| Preferred border thickness | `2px` rectangle | `asset.stroke.default`, `--asset-stroke-default` |
| Minimum border fallback | `1.5px` rectangle | `asset.stroke.minimum`, `--asset-stroke-minimum` |
| Raster export scale | `>= 1.5x` | `asset.export.rasterScale`, `getRasterSourceSize()` |
| Default ratio | `1:1` | `asset.ratio.square`, `--asset-ratio-square` |

## Naming

| Prefix | Use |
| --- | --- |
| `ic_` | Interactive icon assets and SVG/font-delivered symbols. |
| `img_` | Fixed-color, duotone, brand, pictogram, or raster-capable assets. |
| `/` | Variant separator for direction, state, or style, for example `ic_star/border`, `ic_radio/checked/true`, `img_panel/roof`. |

Keep the Figma asset name as the canonical key. CSS helper classes replace `/` with `--`, so `ic_star/border` becomes `asset-icon asset-ic_star--border`.

## Icon Rules

- Start from a 24px square grid and verify legibility at 24px.
- Prefer border-style icons. Pair with filled variants when product states need it.
- Use rectangle-built strokes at 2px. Use 1.5px only when the shape cannot be expressed clearly at 2px.
- Prefer single-tone icons. Treat duotone artwork as an `img_` asset.
- Hand off icons as SVG even if the product eventually fontizes them.

## Image Rules

- Image-style assets follow the same 24px grid and 2px/1.5px construction guidance unless the artwork requires a fixed illustration form.
- Most inspected images are square: 24, 40, 48, 60, or 94px.
- `img_logo_energyx` is the observed non-square exception at `154x24`, ratio `6.4167:1`.
- For jpg/png use, export source assets at least 1.5x the rendered size and downscale in UI.

## Implementation

- Token source: `design-tokens/assets.tokens.json`
- CSS variables and utility classes: `styles/assets.css`
- JavaScript helper: `src/asset-tokens.mjs`
- Type declarations: `src/asset-tokens.d.ts`
- Validation: `test/asset-tokens.test.mjs`
