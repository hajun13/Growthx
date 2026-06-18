# 09 Tabs

Source: Figma node `1:22834`, board title `Guide Board 10`.

The board defines a reusable `asset/tab/body_tab` primitive with variant axes:
`state`, `type`, `size`, `badge`, and `version`.

## Figma Rules

| Axis | Values observed | Development prop |
| --- | --- | --- |
| `state` | `pressed`, `enable`, `hover`, `disabled` | `selected`, `disabled`; hover comes from CSS interaction |
| `type` | `underline`, `box`, `box_border`, `box_basic` | `variant="underline" | "box" | "box-border" | "box-basic"` |
| `size` | `S`, `L` | `size="s" | "l"` |
| `badge` | `off`, `on` | `badge?: boolean` per item |
| `version` | `latest` | Not exposed; implementation always maps to latest |

Underline tabs show a 2px indicator under the tab label when selected. Enable state does not show the bar. Hover state shows the bar for underline tabs, while box types change text styling. Disabled tabs are not selectable.

## Size

| Size | Use | Underline height | Box size | Typography |
| --- | --- | --- | --- | --- |
| `s` | Body section tabs | 36px selected, 34px button area | 67px x 36px min | Pretendard Medium, 13px / 20px, -0.2px |
| `l` | Header-like page section tabs | 52px selected, 50px button area | 86px x 44px min | Pretendard Regular, 24px / 36px |

## Props API

```ts
type TabsVariant = "underline" | "box" | "box-border" | "box-basic";
type TabsSize = "s" | "l";
type TabsOrientation = "horizontal" | "vertical";

type TabItem = {
  id: string;
  label: string;
  disabled?: boolean;
  badge?: boolean;
};

type TabsProps = {
  value: string;
  items: TabItem[];
  variant?: TabsVariant;
  size?: TabsSize;
  orientation?: TabsOrientation;
  onValueChange?: (value: string) => void;
};
```

Use `pressed` only as the Figma source state name. Product code should expose `selected` through `value` and `aria-selected`.

## Accessibility

- Root: `role="tablist"` and `aria-orientation`.
- Trigger: `role="tab"`, `id`, `aria-selected`, `aria-controls`, and `tabindex`.
- Panel: `role="tabpanel"`, `id`, `aria-labelledby`, and `hidden` when inactive.
- Disabled tabs use native `disabled` on buttons or `aria-disabled="true"` when rendered as non-button elements.
- Keyboard behavior should follow the WAI-ARIA tabs pattern: Left/Right for horizontal, Up/Down for vertical, Home/End for first and last tab, Enter/Space to activate when activation is manual.

## CSS Implementation

- Token source: `design-tokens/tabs.tokens.json`
- CSS variables and implementation classes: `styles/tabs.css`
- Root class: `.tabs`
- Trigger class: `.tabs__tab`
- Panel class: `.tabs__panel`

```html
<div class="tabs" data-type="underline" data-size="s" data-orientation="horizontal" role="tablist" aria-orientation="horizontal">
  <button class="tabs__tab" id="tab-overview" role="tab" aria-selected="true" aria-controls="panel-overview" tabindex="0">
    Overview
  </button>
  <button class="tabs__tab" id="tab-history" role="tab" aria-selected="false" aria-controls="panel-history" tabindex="-1">
    History
  </button>
</div>
<section class="tabs__panel" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
  ...
</section>
<section class="tabs__panel" id="panel-history" role="tabpanel" aria-labelledby="tab-history" hidden>
  ...
</section>
```

## Notes

The inspected board shows horizontal sample frames. The development API still includes `orientation` so vertical tablists can expose correct `aria-orientation` and keyboard behavior without changing visual tokens.
