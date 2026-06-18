# 12 Radio, Checkbox, Switch

Source: Figma node `1:28187`, board title `12 라디오와 체크박스, 토글`.

The board contains card-style radio and checkbox options plus a compact switch. Figma variant axes are normalized into native form semantics so product code can keep browser input behavior, keyboard access, form submission, and ARIA state.

## Props API

### Checkbox

| Prop | Values | Default | Maps from Figma |
| --- | --- | --- | --- |
| `checked` | `boolean` | - | `state=checked` |
| `indeterminate` | `boolean` | `false` | `state=half` |
| `disabled` | `boolean` | `false` | `disabled=true` |
| `invalid` | `boolean` | `false` | error state for implementation |
| `size` | `sm`, `lg` | `sm` | `size=s`, `size=L` |
| `label` | text | - | `value` text layer |
| `caption` | text | - | `caption here` text layer |

### Radio

| Prop | Values | Default | Maps from Figma |
| --- | --- | --- | --- |
| `checked` | `boolean` | - | `state=checked` |
| `disabled` | `boolean` | `false` | `disabled=true` |
| `invalid` | `boolean` | `false` | error state for implementation |
| `name` | string | required | native radio group |
| `value` | string | required | native radio value |
| `label` | text | - | `value` text layer |
| `caption` | text | - | `caption here` text layer |

### Switch

| Prop | Values | Default | Maps from Figma |
| --- | --- | --- | --- |
| `checked` | `boolean` | - | `state=on` |
| `mixed` | `boolean` | `false` | `state=indeterminate` |
| `disabled` | `boolean` | `false` | disabled treatment |
| `invalid` | `boolean` | `false` | error state for implementation |
| `label` | text | - | optional product label |

Do not expose Figma-only `version`, `normal`, `half`, `s`, or `L` names in product code. Use `indeterminate` for checkbox mixed state and `mixed` only where a switch truly represents a third aggregate state.

## Recommended Markup

Checkbox:

```tsx
<label className="form-option form-option--sm">
  <input
    className="form-option__input"
    type="checkbox"
    checked={checked}
    disabled={disabled}
    aria-invalid={invalid || undefined}
    ref={(node) => {
      if (node) node.indeterminate = indeterminate;
    }}
  />
  <span className="form-option__body">
    <span className="form-option__label">{label}</span>
    {caption ? <span className="form-option__caption">{caption}</span> : null}
  </span>
</label>
```

Radio:

```tsx
<label className="form-option form-option--lg">
  <input
    className="form-option__input"
    type="radio"
    name={name}
    value={value}
    checked={checked}
    disabled={disabled}
    aria-invalid={invalid || undefined}
  />
  <span className="form-option__body">
    <span className="form-option__label">{label}</span>
    {caption ? <span className="form-option__caption">{caption}</span> : null}
  </span>
</label>
```

Switch:

```tsx
<label className="switch" data-state={mixed ? "mixed" : undefined}>
  <input
    className="switch__input"
    type="checkbox"
    role="switch"
    checked={checked}
    disabled={disabled}
    aria-checked={mixed ? "mixed" : checked}
    aria-invalid={invalid || undefined}
  />
  <span className="switch__track" aria-hidden="true">
    <span className="switch__thumb">{checked ? "✓" : "×"}</span>
  </span>
  {label ? <span className="switch__label">{label}</span> : null}
</label>
```

## CSS Contract

| Concept | CSS |
| --- | --- |
| Option wrapper | `.form-option` |
| Option sizes | `.form-option--sm`, `.form-option--lg` |
| Native input | `.form-option__input` |
| Label body | `.form-option__body` |
| Main label | `.form-option__label` |
| Caption | `.form-option__caption` |
| Switch wrapper | `.switch` |
| Switch native input | `.switch__input` |
| Switch visual track | `.switch__track` |
| Switch visual thumb/icon | `.switch__thumb` |
| Switch label | `.switch__label` |

## Implementation

- Token source: `design-tokens/form-controls.tokens.json`
- CSS variables and primitive classes: `styles/form-controls.css`
- Use native `<input type="checkbox">` and `<input type="radio">`; do not replace controls with buttons.
- Checkbox `indeterminate` must be set on the DOM node property and mirrored visually with `:indeterminate`.
- Switch uses a native checkbox with `role="switch"`. Use `aria-checked="mixed"` only for aggregate or inherited state.
- Invalid/error state is implemented with `aria-invalid="true"` or `data-invalid="true"`. The captured Figma variants did not include separate error artwork, so the error palette is a development-ready extension rather than a direct variant.

## Figma Handoff Notes

Confirmed captured axes and state names:

| Figma component | Figma variants | Product API |
| --- | --- | --- |
| `ic_checkbox` | `state=normal`, `state=checked`, `state=half`, `disabled`, `version=v1/v2` | native checkbox, `checked`, `indeterminate`, `disabled` |
| `asset_checkbox` | `state=normal/checked/half`, `disabled`, `size=s/L`, `version=latest` | checkbox option, `size=sm/lg` |
| `ic_radio` | `state=normal/checked`, `disabled`, `version=v1/v2` | native radio, `checked`, `disabled` |
| `asset_radio` | `state=normal/checked`, `disabled`, `version=latest` | radio option |
| `asset_switch` | `state=off/on/indeterminate`, `version=latest` | switch, `checked`, `mixed` |

Visual rules observed from the board:

- Control icons are 24px for radio and checkbox.
- Option rows use 12px icon/text gap, 8px radius, and 8px vertical padding with 12px/16px horizontal padding.
- Selected radio and checkbox options use `#F7F6F8` background, `#4C1E8B` label, and `#8C5ECE` caption.
- Disabled options keep the white background and dim label/caption to `#CDCCCF` / `#EBEAEC`.
- Switch is 60px by 24px with centered 12px on/off glyphs; on is `#4DBFB8`, off is `#CDCCCF`, indeterminate is `#D5E3E2`.
