# 04 Margin, Padding, Spacing

Source: Figma node `1:16921`, board title `마진, 패딩, 간격`.

The board defines the shared scale for UI margin, padding, and gap values. It recommends flexible widths where possible, and says explicit widths, heights, and spacing should generally use multiples of 8. Text-adjacent spacing may also use multiples of 4. The board calls out `16` and `24` as the most frequently used units.

## Tokens

| Token | Label | CSS variable | Value |
| --- | --- | --- | --- |
| `spacing.xxs` | XXS | `--spacing-xxs` | `4px` |
| `spacing.xs` | XS | `--spacing-xs` | `8px` |
| `spacing.s` | S | `--spacing-s` | `12px` |
| `spacing.m` | M | `--spacing-m` | `16px` |
| `spacing.l` | L | `--spacing-l` | `20px` |
| `spacing.xl` | XL | `--spacing-xl` | `24px` |
| `spacing.xxl` | XXL | `--spacing-xxl` | `40px` |
| `spacing.xxxl` | XXXL | `--spacing-xxxl` | `48px` |

## Layout Aliases

Use semantic layout aliases in product code when a spacing value expresses a repeated layout relationship:

| Alias | Maps to | Use |
| --- | --- | --- |
| `layout.stack` | `spacing.m` | Default gap between related UI elements. |
| `layout.cluster` | `spacing.xl` | Looser gap for grouped controls, cards, or content clusters. |
| `layout.section` | `spacing.xxxl` | Large gap between major sections. |

## Rules

- Prefer spacing tokens, CSS variables, or utilities over hard-coded `margin`, `padding`, and `gap` values.
- Use `16px` and `24px` first for common component spacing unless the design calls for a tighter or looser relationship.
- Use `4px` primarily for tight text-adjacent spacing. The main layout rhythm should remain on the 8px scale.
- Keep flexible layout sizing where practical; reserve explicit width and height values for cases that need fixed measurement.

## Implementation

- Token source: `design-tokens/spacing.tokens.json`
- CSS variables and utility classes: `styles/spacing.css`
- Utilities are intentionally limited to all-side `margin`, all-side `padding`, and `gap` helpers so component code can migrate away from literals without introducing a large utility surface.

## Figma Notes

The board frame itself uses large documentation-layout values such as `187px` horizontal board padding, `80px` header top padding, `24px` section padding, and `48px` section gaps. These describe the guide-board composition, not the product spacing scale, so they are not promoted as reusable tokens.
