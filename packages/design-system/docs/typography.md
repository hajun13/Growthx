# 02 Typography

Source: Figma node `1:16375`, board frame `Guide Board 23`.

The board defines Pretendard as the Korean and English product font. It notes that Japanese text should use Pretendard JP, and that fonts should preferably be loaded as web fonts.

## Tokens

| Token | Figma style | CSS class | Weight | Size | Line height | Letter spacing |
| --- | --- | --- | --- | --- | --- | --- |
| `typography.v2.h1` | `V2/H1` | `.text-v2-h1` | 700 | 38px | 54px | -0.5px |
| `typography.v2.h2` | `V2/H2` | `.text-v2-h2` | 700 | 30px | 46px | -0.5px |
| `typography.v2.body3Strong` | `V2/Body3_h` | `.text-v2-body3-strong` | 700 | 22px | 34px | -0.2px |
| `typography.v2.body3` | `V2/Body3` | `.text-v2-body3` | 400 | 22px | 34px | -0.2px |
| `typography.v2.title1Strong` | `V2/Title1_h` | `.text-v2-title1-strong` | 700 | 20px | 32px | 0px |
| `typography.v2.title2Strong` | `V2/Title2_h` | `.text-v2-title2-strong` | 700 | 18px | 28px | -0.2px |
| `typography.v2.title` | `Title` | `.text-v2-title` | 500 | 18px | 28px | -0.2px |
| `typography.v2.subtitle` | `Subtitle` | `.text-v2-subtitle` | 500 | 16px | 24px | 0px |
| `typography.v2.bodyStrong` | `Body_h` | `.text-v2-body-strong` | 700 | 16px | 24px | 0px |
| `typography.v2.body1` | `Body1` | `.text-v2-body1` | 400 | 16px | 24px | -0.1px |
| `typography.v2.subtitle2Strong` | `v2/Subtitle2_h` | `.text-v2-subtitle2-strong` | 700 | 14px | 20px | 0px |
| `typography.v2.subtitle2` | `V2/Subtitle2` | `.text-v2-subtitle2` | 400 | 14px | 20px | 0px |
| `typography.v2.body2` | `Body2` | `.text-v2-body2` | 500 | 13px | 18px | 0px |
| `typography.v2.buttonXl` | `v2/Button_xl` | `.text-v2-button-xl` | 500 | 18px | 28px | -0.25px |
| `typography.v2.buttonL` | `v2/Button_l` | `.text-v2-button-l` | 500 | 16px | 28px | 0px |
| `typography.v2.buttonM` | `v2/Button_m` | `.text-v2-button-m` | 700 | 14px | 20px | 0.2px |
| `typography.v2.buttonS` | `V2/Button_s` | `.text-v2-button-s` | 500 | 13px | 20px | -0.2px |
| `typography.v2.buttonSStrong` | `v2/Button_s_h` | `.text-v2-button-s-strong` | 700 | 13px | 20px | 0.1px |
| `typography.v2.captionStrong` | `Caption_h` | `.text-v2-caption-strong` | 700 | 12px | 18px | 0px |
| `typography.v2.caption` | `Caption` | `.text-v2-caption` | 400 | 12px | 18px | 0px |
| `typography.v2.overlineStrong` | `v2/overline_h` | `.text-v2-overline-strong` | 700 | 10px | 14px | 0.1px |
| `typography.v2.overline` | `overline` | `.text-v2-overline` | 400 | 10px | 14px | 0px |

## Implementation

- Token source: `design-tokens/typography.tokens.json`
- CSS variables and utility classes: `styles/typography.css`
- Use semantic text utilities for app code instead of hard-coded `font-size`, `font-weight`, `line-height`, and `letter-spacing`.
- Keep the CSS `font` custom properties paired with their matching `*-letter-spacing` variables because CSS shorthand cannot encode letter spacing.
