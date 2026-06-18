# 15 Confirm Dialog

Source: Figma node `1:29088`, board title `15 확인창`.

The board resolves to `Guide Board 37` with five guide sections under the board frame. Figma inspection confirmed the relevant confirm-dialog sections as `확인창(팝업창)_basic`, `확인창(팝업창) 사용처`, `확인창(팝업창)_info`, and `확인창(팝업창) 위치`; the final section is a toast/snackbar position note and is intentionally not exposed through this API. Figma variable extraction confirmed the dialog palette and type tokens: white surface, black/mono text, mono10 border, primary60 default action, red60 danger action, and elevation4 shadow.

## Props API

Use these props for a component wrapper:

| Prop | Values | Default | Maps from Figma |
| --- | --- | --- | --- |
| `open` | `boolean` | `true` | overlay visibility |
| `intent` | `default`, `danger` | `default` | default/danger confirm state |
| `title` | text | - | title text |
| `description` | text | - | body text |
| `cancelLabel` | text | `Cancel` | secondary action |
| `confirmLabel` | text | `Confirm` | primary action |
| `actionLayout` | `horizontal`, `stacked` | `horizontal` | action group layout |

Keep product code semantic. Do not expose Figma-only frame names such as `part_board`, guide-board labels, or visual token names as props.

## Recommended Component Shape

```tsx
type ConfirmDialogIntent = "default" | "danger";
type ConfirmDialogActionLayout = "horizontal" | "stacked";

type ConfirmDialogProps = {
  open: boolean;
  intent?: ConfirmDialogIntent;
  title: React.ReactNode;
  description?: React.ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  actionLayout?: ConfirmDialogActionLayout;
  onCancel: () => void;
  onConfirm: () => void;
};
```

Suggested markup:

```tsx
<div className={getConfirmDialogOverlayClasses({ open })}>
  <section
    className={getConfirmDialogClasses({ intent, actionLayout, open })}
    {...getConfirmDialogA11yProps({ id: "delete-dialog" })}
    onKeyDown={(event) => trapConfirmDialogFocus(event, event.currentTarget)}
  >
    <div className="confirm-dialog__content">
      <h2 className="confirm-dialog__title" id="delete-dialog-title">{title}</h2>
      <p className="confirm-dialog__body" id="delete-dialog-description">{description}</p>
    </div>
    <div className="confirm-dialog__actions">
      <button {...actions.cancel} onClick={onCancel} />
      <button {...actions.confirm} onClick={onConfirm} />
    </div>
  </section>
</div>
```

## Accessibility Contract

- Dialog container must use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby` when body text exists.
- Move focus into the dialog when it opens and restore focus to the trigger when it closes.
- Keep focus trapped while open. `trapConfirmDialogFocus` handles Tab and Shift+Tab wrapping for vanilla DOM usage.
- Escape/backdrop dismissal is a product decision, but cancellation must be reachable from the keyboard.
- Confirm and cancel controls should be native `<button type="button">` elements.

## CSS Contract

| Concept | CSS |
| --- | --- |
| Overlay | `.confirm-dialog__overlay`, `.confirm-dialog__overlay--open` |
| Surface | `.confirm-dialog`, `.confirm-dialog--default`, `.confirm-dialog--danger` |
| Content stack | `.confirm-dialog__content` |
| Title/body | `.confirm-dialog__title`, `.confirm-dialog__body` |
| Actions | `.confirm-dialog__actions`, `.confirm-dialog--actions-stacked` |
| Buttons | `.confirm-dialog__action`, `.confirm-dialog__action--cancel`, `.confirm-dialog__action--confirm` |

## Implementation

- CSS variables and primitive classes: `styles/confirm-dialog.css`
- Semantic class/ARIA/focus helpers: `src/confirm-dialog.mjs`
- Type declarations: `src/confirm-dialog.d.ts`
- API tests: `test/confirm-dialog.test.mjs`

## Figma Handoff Notes

Figma MCP variable extraction and shallow section inspection succeeded for node `1:29088`. Full recursive metadata and text traversal timed out, so this handoff intentionally sticks to the confirmed section names, board structure, and variable definitions instead of inventing extra variants. The exposed API covers the states named in the delegation: title/body/actions, default and danger confirmation, overlay, layout, and modal accessibility.
