# 10 Input

Source: Figma node `1:22980`, board title `10 입력창`.

The board is Guide Board 32. It contains `asset/input` and `asset/input_set` examples for desktop and mobile text fields, select fields, label visibility, prefix/suffix icons, counters, single-line fields, and supporting text. Figma exposes many raw axes, so product code should use a smaller TextField API.

## Figma Findings

Confirmed variant axes:

| Figma axis | Observed values | Product API |
| --- | --- | --- |
| `style` | `textfield`, `select` | `variant` |
| `state` | `enabled`, `focused`, `error`, disabled examples | native focus, `invalid`, `disabled` |
| `label display` | `true`, `false`, `empty` | `label`, `hideLabel`, optional label reservation |
| `first icon` | `true`, `false` | `prefix` or `leadingIcon` |
| `secondicon` | `true`, `false` | `suffix`, `trailingIcon`, clear/error/select affordance |
| `counter limit` | `true`, `false` | `maxLength`, `showCount` |
| `input line` | `single` plus multiline examples | `multiline` |
| `device` | `desktop`, `mobile`, `mobile2` examples | `size` |
| `typing state` | `placeholder`, `typed`, `on focuesd`, `on typing` | native value/placeholder/focus state |

Primary dimensions seen in the board are `270x60` for desktop, `270x50` for mobile, and wider composed examples such as `300x60`, `318x60`, `384x60`, and `407x60`. Width should be layout-controlled; height and density come from `size`.

## Props API

```tsx
type TextFieldSize = "desktop" | "mobile";
type TextFieldVariant = "textfield" | "select";

type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> & {
  id: string;
  label?: React.ReactNode;
  hideLabel?: boolean;
  size?: TextFieldSize;
  variant?: TextFieldVariant;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  helperText?: React.ReactNode;
  errorText?: React.ReactNode;
  showCount?: boolean;
  multiline?: boolean;
};
```

Use `invalid`/`errorText` rather than exposing Figma's `state=error`. Use native `disabled`, `placeholder`, `value`, `focus`, and `maxLength` for the remaining state axes.

## Accessibility Contract

Labels and supporting text are part of the component contract:

```tsx
const invalid = Boolean(errorText);
const describedBy = [
  helperText ? `${id}-helper` : undefined,
  errorText ? `${id}-error` : undefined,
].filter(Boolean).join(" ") || undefined;

<label className={hideLabel ? "sr-only" : "text-field__label"} htmlFor={id}>
  {label}
</label>
<input
  id={id}
  aria-invalid={invalid ? "true" : undefined}
  aria-describedby={describedBy}
/>
```

Render helper text with `id="${id}-helper"` and error text with `id="${id}-error"`. Error text takes visual priority, but helper and error ids can both be included when both are present.

## CSS Contract

| Concept | CSS |
| --- | --- |
| Root primitive | `.text-field` |
| Sizes | `.text-field--desktop`, `.text-field--mobile` |
| Variants | `.text-field--textfield`, `.text-field--select` |
| States | `.text-field--error`, `.text-field--disabled`, native `:focus-within` |
| Control | `.text-field__control` |
| Input/textarea | `.text-field__input`, `.text-field__textarea` |
| Prefix/suffix | `.text-field__prefix`, `.text-field__suffix` |
| Icons | `.text-field__icon` |
| Helper/error/counter | `.text-field__support`, `.text-field__helper`, `.text-field__error`, `.text-field__counter` |

## Implementation

- Token source: `design-tokens/input.tokens.json`
- CSS primitive: `styles/input.css`
- Props/class/accessibility utilities: `src/input.mjs`, `src/input.d.ts`
- The component boundary should translate Figma's raw `first icon`, `secondicon`, `counter limit`, and `typing state` axes to semantic props.
- Width is not a variant. Keep width controlled by the surrounding layout while preserving the board minimum width.

## Figma Handoff Notes

The board references V2 tokens such as `V2/primary/primary60`, `V2/mono/mono20`, `V2/mono/mono70`, `V2/error/red60`, `V2/error/red10`, and `Gray Transparent/GTrans-04`. The raw Figma spelling `on focuesd` is treated as a design-state typo and is represented in code by native focus handling.
