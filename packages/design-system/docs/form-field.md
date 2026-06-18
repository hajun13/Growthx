# 13 Input Form

Source: Figma node `1:28508`, board title `13 입력폼`, visible title `입력폼 set`.

The board combines the lower-level input, selector/form-control, and button primitives into a field-level API. Product code should expose form semantics instead of raw Figma layer names such as `asset/input_set`, `.captionbox`, or `#wrap_button`.

## Props API

| Component | Prop | Values | Default | Maps from Figma |
| --- | --- | --- | --- | --- |
| `FormField` | `required` | `boolean` | `false` | required marker / validation contract |
| `FormField` | `disabled` | `boolean` | `false` | disabled control state |
| `FormField` | `invalid` | `boolean` | `false` | error state |
| `FormField` | `helperText` | text node | - | `caption here` |
| `FormField` | `errorMessage` | text node | - | `error here` |
| `FormField` | `unit` | text node | - | trailing unit slot |
| `FormField` | `actions` | button node(s) | - | optional button area |
| `FormField` | `buttonLayout` | `none`, `single`, `double` | `none` | button none/one/two examples |
| `FormGroup` | `direction` | `vertical`, `horizontal` | `vertical` | stacked fields vs desktop rows |
| `FormGroup` | `columns` | positive integer | `1` | equal-width field groups |

Only one status message is rendered at a time. `errorMessage` wins over `helperText`; when the error condition clears, the error text is removed and helper text may remain.

## Recommended Component Shape

```tsx
type FormFieldProps = {
  id: string;
  label?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  helperText?: React.ReactNode;
  errorMessage?: React.ReactNode;
  unit?: React.ReactNode;
  actions?: React.ReactNode;
  buttonLayout?: "none" | "single" | "double";
  children: React.ReactElement;
};

type FormGroupProps = {
  direction?: "vertical" | "horizontal";
  columns?: number;
  children: React.ReactNode;
};
```

Suggested markup:

```tsx
<div className={getFormFieldClasses({ required, disabled, invalid, hasUnit: Boolean(unit), buttonLayout, helperText, errorMessage })}>
  {label ? <label className="form-field__label" htmlFor={id}>{label}</label> : null}
  <div className="form-field__control-row">
    <div className="form-field__input-wrap">
      {children}
      {unit ? <span className="form-field__unit">{unit}</span> : null}
    </div>
    {actions ? <div className="form-field__actions">{actions}</div> : null}
  </div>
  {errorMessage ? (
    <p className="form-field__message form-field__message--error">{errorMessage}</p>
  ) : helperText ? (
    <p className="form-field__message">{helperText}</p>
  ) : null}
</div>
```

## Layout Rules

| Rule | Value |
| --- | --- |
| Input minimum height | `60px` |
| Input horizontal padding | `16px` |
| Input vertical padding | `8px` |
| Input internal gap | `4px` |
| Input to caption/error gap | `4px` |
| Input to button gap | `24px` |
| Message horizontal inset | `16px` |

Desktop forms place input and buttons in one row. Mobile layouts may stack the action area below the input while preserving the 24px action gap when row layout is used.

## CSS Contract

| Concept | CSS |
| --- | --- |
| Field root | `.form-field` |
| Control row | `.form-field__control-row` |
| Input container | `.form-field__input-wrap` |
| Native input/select/control slot | `.form-field__input` |
| Unit slot | `.form-field__unit` |
| Button/action slot | `.form-field__actions` |
| Helper/error message | `.form-field__message` |
| Error message modifier | `.form-field__message--error` |
| Required state | `.form-field--required` |
| Invalid state | `.form-field--invalid` |
| Disabled state | `.form-field--disabled` |
| Group root | `.form-group` |

## Implementation

- Token source: `design-tokens/form-field.tokens.json`
- CSS variables and primitive classes: `styles/form-field.css`
- Semantic class/ARIA helper: `src/form-field.mjs`
- Type declarations: `src/form-field.d.ts`
- API tests: `test/form-field.test.mjs`

## Dependencies

- Board 10 input window: supplies the base input visual, placeholder behavior, typed state, and text metrics used inside `.form-field__input-wrap`.
- Board 11 selector: should occupy the same control slot as an input and inherit the field wrapper, helper, error, required, and disabled semantics.
- Board 12 form control: checkbox/radio/toggle groups should use `FormGroup` spacing and validation message behavior when presented as a field.
- Board 07 button: button actions should reuse the existing button API; this board only defines their placement and spacing relative to inputs.

## Figma Handoff Notes

Confirmed from node `1:28508`: button presence can be none, one, or two buttons; caption and error are mutually exclusive status messages; input-to-button spacing is `24px`; input-to-caption spacing is `4px`; unit text is a trailing input adornment. Figma `get_metadata` and a compact `use_figma` traversal timed out in this thread, so the implementation is based on `get_design_context` output plus variable definitions from the node.
