# 11 Select

Source: Figma node `1:27956`, board title `11 셀렉터`.

The board is normalized as a Select primitive with trigger, menu, option, state, and size rules. Product code should consume semantic props and ARIA contracts rather than raw Figma layer names.

Note: this thread did not receive an active `use_figma` MCP tool, and the public Figma URL was not readable from the tool environment. The handoff below is therefore implemented from the delegated board scope and aligned with the existing component token conventions in this checkout.

## Props API

| Prop | Values | Default | Maps from Figma |
| --- | --- | --- | --- |
| `size` | `sm`, `md`, `lg` | `md` | size variants |
| `open` | `boolean` | `false` | expanded trigger and visible menu state |
| `disabled` | `boolean` | `false` | disabled trigger state |
| `invalid` | `boolean` | `false` | error or validation state |
| `multiple` | `boolean` | `false` | listbox multi-select behavior |
| `placeholder` | text | `Select an option` | placeholder label |
| `value` | option value or value array | - | selected option state |
| `options` | option list | - | menu option rows |

Do not expose Figma-only layer names such as trigger, menu, option, state, or icon variants as top-level product props. They are implementation parts behind the Select boundary.

## Recommended Component Shape

```tsx
type SelectSize = "sm" | "md" | "lg";
type SelectValue = string | number;

type SelectOption = {
  value: SelectValue;
  label: React.ReactNode;
  disabled?: boolean;
};

type SelectProps = {
  size?: SelectSize;
  value?: SelectValue | SelectValue[];
  defaultValue?: SelectValue | SelectValue[];
  options: SelectOption[];
  open?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  multiple?: boolean;
  placeholder?: string;
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: SelectValue | SelectValue[]) => void;
};
```

Suggested markup:

```tsx
<div className={getSelectClassNames({ size, open, disabled, invalid, multiple })}>
  <button className="select__trigger" type="button" {...aria.trigger}>
    <span className={value ? "select__value" : "select__value select__value--placeholder"}>
      {valueLabel ?? placeholder}
    </span>
    <span className="select__icon" aria-hidden="true" />
  </button>
  <div className="select__menu" {...aria.listbox}>
    {options.map((option) => (
      <div className="select__option" {...getOptionAriaProps(option, context)}>
        {option.label}
      </div>
    ))}
  </div>
</div>
```

## Keyboard And Accessibility

Use the trigger as a `button` with `role="combobox"`, `aria-haspopup="listbox"`, and `aria-expanded`. When open, connect the trigger to the menu with `aria-controls` and track the active option with `aria-activedescendant`.

| Key | Behavior |
| --- | --- |
| `ArrowDown` | Opens the menu and moves to the next enabled option. |
| `ArrowUp` | Opens the menu and moves to the previous enabled option. |
| `Home` | Moves to the first enabled option. |
| `End` | Moves to the last enabled option. |
| `Enter` / `Space` | Opens the menu, or selects the highlighted enabled option. |
| `Escape` | Closes the menu without changing value. |

Disabled options keep `role="option"` but set `aria-disabled="true"` and are skipped by keyboard movement.

## CSS Contract

| Concept | CSS |
| --- | --- |
| Root primitive | `.select` |
| Trigger | `.select__trigger` |
| Value text | `.select__value` |
| Placeholder text | `.select__value--placeholder` |
| Indicator icon | `.select__icon` |
| Menu | `.select__menu` |
| Option row | `.select__option` |
| Sizes | `.select--sm`, `.select--md`, `.select--lg` |
| States | `.select--open`, `.select--invalid`, `.select--disabled` |
| Multi-select | `.select--multiple` |

## Implementation

- Token source: `design-tokens/select.tokens.json`
- CSS variables and primitive classes: `styles/select.css`
- JS helper and keyboard reducer: `src/select.mjs`
- Type declarations: `src/select.d.ts`
- Tests: `test/select.test.mjs`

The helper functions are intentionally framework-neutral. React, Vue, or vanilla implementations can use them to keep class names, ARIA attributes, option state, and keyboard behavior consistent with the 11 Select handoff.
