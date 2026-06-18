# 07 Button

Source: Figma node `1:17241`, board title `07 버튼`.

The board was handed off as Guide Board 28 with about 125 button instances and about 110 variant combinations. The Figma variant axes are normalized into a product API instead of exposing raw Figma names.

## Props API

Use these props for a component wrapper:

| Prop | Values | Default | Maps from Figma |
| --- | --- | --- | --- |
| `variant` | `contained`, `outlined`, `text` | `contained` | `contained`, `outlined`, `text` |
| `size` | `sm`, `md`, `lg` | `md` | `size` |
| `disabled` | `boolean` | `false` | disabled state |
| `leftIcon` | icon node | - | `left_icon` |
| `rightIcon` | icon node | - | `right_icon` |
| `children` | text | - | `text` |
| `service` | `default`, `kakao`, `naver`, `google`, `apple` | `default` | service axis |

Do not expose the Figma-only `state`, `version`, `left_icon`, or `right_icon` names in product code. State is represented by native interaction and `disabled`; icon placement is represented by `leftIcon` and `rightIcon`.

## Recommended Component Shape

```tsx
type ButtonVariant = "contained" | "outlined" | "text";
type ButtonSize = "sm" | "md" | "lg";
type ButtonService = "default" | "kakao" | "naver" | "google" | "apple";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  service?: ButtonService;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};
```

Class composition:

```tsx
const classes = [
  "button",
  `button--${size}`,
  service === "default" ? `button--${variant}` : `button--service-${service}`,
  !children && (leftIcon || rightIcon) ? "button--icon-only" : undefined,
].filter(Boolean).join(" ");
```

Suggested markup:

```tsx
<button className={classes} disabled={disabled} type="button">
  {leftIcon ? <span className="button__icon">{leftIcon}</span> : null}
  {children ? <span className="button__label">{children}</span> : null}
  {rightIcon ? <span className="button__icon">{rightIcon}</span> : null}
</button>
```

## CSS Contract

| Concept | CSS |
| --- | --- |
| Base primitive | `.button` |
| Variants | `.button--contained`, `.button--outlined`, `.button--text` |
| Sizes | `.button--sm`, `.button--md`, `.button--lg` |
| Icon-only | `.button--icon-only` |
| Service palettes | `.button--service-kakao`, `.button--service-naver`, `.button--service-google`, `.button--service-apple` |
| Icon slot | `.button__icon` |
| Text slot | `.button__label` |

## Implementation

- Token source: `design-tokens/button.tokens.json`
- CSS variables and primitive classes: `styles/button.css`
- Semantic class/ARIA helper: `src/button.mjs`
- Type declarations: `src/button.d.ts`
- API tests: `test/button.test.mjs`
- Use semantic props in product code and translate them to classes at the component boundary.
- Service buttons intentionally override visual variant styling because the service axis is a branded palette, not another Figma variant name.
- Disabled state relies on the native `disabled` attribute for `<button>` and `aria-disabled="true"` for link-style usage.

## Figma Handoff Notes

The confirmed board axes are `contained`, `outlined`, `left_icon`, `right_icon`, `text`, `state`, `size`, `service`, and `version`. The implementation keeps only stable product semantics: `variant`, `size`, `disabled`, `leftIcon`, `rightIcon`, `children`, and `service`.

This thread did not receive an active `use_figma` MCP tool, so the implementation is based on the handoff metadata supplied with the delegation rather than a fresh node traversal in this thread.
