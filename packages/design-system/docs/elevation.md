# 05 Elevation

Source: Figma node `1:16968`, board title `엘레베이션`.

The board defines five elevation levels. It notes that elevation expresses layer height and is used sparingly in version 1 designs.

Figma note: the fifth sample is visually labeled as elevation 5 and uses its own effect style id, but the frame name is duplicated as `elevation/elevation4` in the inspected node tree. The implementation keeps the semantic token as `elevation.level5`.

## Tokens

| Token | Figma style | CSS variable | Shadow |
| --- | --- | --- | --- |
| `elevation.level1` | `elevation/elevation1` | `--elevation-1` | `0px 2px 4px 0px rgb(0 0 0 / 24%)` |
| `elevation.level2` | `elevation/elevation2` | `--elevation-2` | `0px 4px 8px 0px rgb(0 0 0 / 16%)` |
| `elevation.level3` | `elevation/elevation3` | `--elevation-3` | `0px 8px 16px 0px rgb(0 0 0 / 12%)` |
| `elevation.level4` | `elevation/elevation4` | `--elevation-4` | `0px 16px 24px 0px rgb(0 0 0 / 10%)` |
| `elevation.level5` | `elevation/elevation5` | `--elevation-5` | `0px 2px 25px 0px rgb(0 0 0 / 10%)` |

## Surface Rules

Use semantic surface depth aliases in product code when possible:

| Surface alias | Maps to | Use |
| --- | --- | --- |
| `surface.raised` | `elevation.level1` | First choice when nearby space needs visible separation. |
| `surface.floating` | `elevation.level4` | Strong floating surfaces such as FAB buttons or headers. Avoid frequent use. |
| `surface.overlay` | `elevation.level5` | Exceptional overlay surfaces that need a soft, broad shadow. |

Levels 2 and 3 remain available as intermediate depth steps when a screen needs clearer hierarchy than level 1 but should not read as strongly floating as level 4.

## Implementation

- Token source: `design-tokens/elevation.tokens.json`
- CSS variables and utility classes: `styles/elevation.css`
- Prefer `box-shadow: var(--surface-depth-raised)` over hard-coded shadow values for component surfaces.
- Use direct `--elevation-*` variables only in low-level primitives, token documentation, or migration shims.
- The inspected Figma shadows are referenced by `effectStyleId`, but they are not local effect styles in this file, so the codebase stores the resolved values directly as tokens.
