# 08 Chip, Label

Source: Figma node `1:18640`, board title `칩(레이블, 라벨)`.

The board defines four small metadata components:

| Component | Figma component | Props API | Notes |
| --- | --- | --- | --- |
| Label | `asset/label` | `variant: "fill" / "border"`, `tone: "primary" / "darkgray" / "secondary" / "red" / "lightgray"` | Text stays on one line. |
| Hashtag chip | `asset/hashtag` | `kind: "toggle" / "user"`, `selected?: boolean`, `removable?: boolean`, `after?: boolean` | Toggle chips use a leading icon. User-made chips use a trailing remove action until the final after state. |
| Hashtag label | `asset/hashtaglabel` | `tone: "default" / "partner"` | Render the hash prefix without whitespace, e.g. `#hashtaglabel`. |
| Value chip | `asset` | `swatchColor`, `children` | Small color swatch plus value text. |

## Figma Variants

### Label

| Figma variant | Size | Background | Border | Text |
| --- | --- | --- | --- | --- |
| `type=fill, color=primary` | `52x22` | `#7A37D8` | none | `#FFFFFF` |
| `type=fill, color=darkgray` | `52x22` | `#CDCCCF` | none | `#FFFFFF` |
| `type=fill, color=secondary` | `52x22` | `#4DBFB8` | none | `#FFFFFF` |
| `type=fill, color=red` | `52x22` | `#FF3F56` | none | `#FFFFFF` |
| `type=fill, color=lightgray` | `52x22` | `#F6F6F6` | none | `#9F9DA1` |
| `type=border, color=primary` | `52x22` | `#F7F6F8` | `2px #7A37D8` | `#7A37D8` |
| `type=border, color=darkgray` | `52x22` | `#F6F6F6` | `2px #727174` | `#727174` |
| `type=border, color=secondary` | `52x22` | `#EDF0F0` | `2px #4DBFB8` | `#4DBFB8` |
| `type=border, color=red` | `52x22` | `#FFF9FA` | `2px #FF3F56` | `#FF3F56` |
| `type=border, color=lightgray` | `52x22` | `#F6F6F6` | `2px #B4B4B6` | `#B4B4B6` |

Shared label spec: `height 22px`, `padding 2px 12px`, `radius 8px`, `Pretendard Bold 12px/18px`.

### Hashtag Chip

| Figma combination | Props | Size | Visual/action |
| --- | --- | --- | --- |
| `type=toggle, state=enable` | `kind="toggle" selected={false}` | `116x36` | White background, `1px #E5E1EC` border, leading icon. |
| `type=toggle, state=pressed` | `kind="toggle" selected` | `116x36` | `#F7F6F8` background, leading icon. |
| `type=usermade, state=default` | `kind="user" removable` | `116x36` | `#F7F6F8` background, trailing remove action. |
| `type=usermade, state=after` | `kind="user" after` | `92x36` | `#F7F6F8` background, no action icon. |

Shared hashtag spec: `height 36px`, `radius 8px`, `gap 8px`, icon `20px`, text `#632AB3`, `Pretendard Medium 13px/18px`.

### Hashtag Label

| Figma variant | Size | Border | Text |
| --- | --- | --- | --- |
| `type=default` | `104x26` | `1px #EBEAEC` | `#727174` |
| `type=partner` | `104x26` | `1px #E5E1EC` | `#FAFAFA` |

Shared hashtag label spec: `height 26px`, `padding 4px 12px`, `radius 8px`, `Pretendard Regular 12px/18px`.

### Value Chip

The value chip is `65x20`, with `1px #F6F6F6` border, `8px` radius, `8px` color swatch, `10px` gap, `1px 8px` padding, and `Pretendard Bold 12px/18px #9F9DA1` text.

## CSS API

Use the CSS module as a low-level implementation target:

```html
<span class="ds-label ds-label--fill ds-label--primary">label</span>
<span class="ds-label ds-label--border ds-label--red">label</span>

<button class="ds-hashtag-chip ds-hashtag-chip--with-leading-icon" aria-pressed="false">
  <span class="ds-hashtag-chip__icon" aria-hidden="true"></span>
  hashtag
</button>

<button class="ds-hashtag-chip ds-hashtag-chip--with-leading-icon" aria-pressed="true">
  <span class="ds-hashtag-chip__icon" aria-hidden="true"></span>
  hashtag
</button>

<span class="ds-hashtag-chip ds-hashtag-chip--user ds-hashtag-chip--removable" role="group">
  hashtag
  <button class="ds-hashtag-chip__remove" type="button" aria-label="Remove hashtag"></button>
</span>

<span class="ds-hashtag-label">#hashtaglabel</span>
<span class="ds-hashtag-label ds-hashtag-label--partner">#hashtaglabel</span>

<span class="ds-value-chip">
  <span class="ds-value-chip__swatch" style="--chip-value-swatch: #7A37D8"></span>
  value
</span>
```

## React-Friendly Props

Recommended component shape:

```ts
type LabelProps = {
  children: string;
  tone?: "primary" | "darkgray" | "secondary" | "red" | "lightgray";
  variant?: "fill" | "border";
};

type HashtagChipProps = {
  children: string;
  kind?: "toggle" | "user";
  selected?: boolean;
  removable?: boolean;
  after?: boolean;
  leadingIcon?: React.ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
};

type HashtagLabelProps = {
  children: string;
  tone?: "default" | "partner";
};

type ValueChipProps = {
  children: string;
  swatchColor: string;
};
```

Map the Figma `state` axis to behavior instead of exposing it directly: `enable` is `selected=false`, `pressed` is `selected=true`, `default` user-made chips are `removable=true`, and `after` is `after=true` with no remove action.

## Implementation

- Token source: `design-tokens/chip.tokens.json`
- CSS variables and classes: `styles/chip.css`
- Props/class helper: `src/chip.mjs`
- Keep chip and label text single-line. Let the parent layout decide overflow handling.
- Prefer semantic props (`tone`, `variant`, `selected`, `removable`, `after`) over raw Figma axes in product code.
