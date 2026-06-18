# 01 Color Handoff

Source: Figma `Lf3LDHggHdJ6ICy5sOqQ4n`, node `1:16027` (`Guide Board 21`)

This handoff keeps the visual palette and the Figma variable system separate:

- `tokens/color-board-01.json` contains the raw board palette and Figma variable metadata.
- `src/color-tokens.mjs` exposes a small runtime API for product code.
- `styles/color-tokens.css` exposes the semantic CSS variables used by the Figma variables.

## Palette Families

The board contains 59 swatches:

- `base`: black, white
- `mono`: 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 05
- `primary`: 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 05
- `secondary`: 100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 05
- `red`, `green`, `yellow`, `blue`: 100, 80, 60, 40, 20, 10

## Semantic Color

Figma also defines `2026 Glass / Semantic Color` with `Light`, `Dark`, and `High Contrast` modes:

| Token | CSS variable |
| --- | --- |
| `color/surface/canvas` | `--color-surface-canvas` |
| `color/surface/glass` | `--color-surface-glass` |
| `color/text/primary` | `--color-text-primary` |
| `color/text/secondary` | `--color-text-secondary` |
| `color/accent/primary` | `--color-accent-primary` |
| `color/accent/warm` | `--color-accent-warm` |

Use palette tokens for fixed brand/spec references. Use semantic tokens for UI surfaces, text, accents, and mode-aware rendering.
