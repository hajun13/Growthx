export const confirmDialogIntents = ["default", "danger"];
export const confirmDialogActionLayouts = ["horizontal", "stacked"];

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "details > summary:first-of-type",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function assertOneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${name} must be one of: ${allowed.join(", ")}`);
  }
}

export function getConfirmDialogClasses({
  intent = "default",
  actionLayout = "horizontal",
  open = true,
  className = "",
} = {}) {
  assertOneOf("intent", intent, confirmDialogIntents);
  assertOneOf("actionLayout", actionLayout, confirmDialogActionLayouts);

  return [
    "confirm-dialog",
    `confirm-dialog--${intent}`,
    `confirm-dialog--actions-${actionLayout}`,
    open ? "confirm-dialog--open" : "",
    className,
  ].filter(Boolean).join(" ");
}

export function getConfirmDialogOverlayClasses({ open = true, className = "" } = {}) {
  return ["confirm-dialog__overlay", open ? "confirm-dialog__overlay--open" : "", className]
    .filter(Boolean)
    .join(" ");
}

export function getConfirmDialogA11yProps({
  id = "confirm-dialog",
  titleId = `${id}-title`,
  descriptionId = `${id}-description`,
  describedBy = true,
} = {}) {
  return {
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": titleId,
    ...(describedBy ? { "aria-describedby": descriptionId } : {}),
    tabIndex: -1,
  };
}

export function getConfirmDialogActionProps({
  intent = "default",
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
} = {}) {
  assertOneOf("intent", intent, confirmDialogIntents);

  return {
    cancel: {
      className: "confirm-dialog__action confirm-dialog__action--cancel",
      type: "button",
      children: cancelLabel,
    },
    confirm: {
      className: `confirm-dialog__action confirm-dialog__action--confirm confirm-dialog__action--${intent}`,
      type: "button",
      children: confirmLabel,
    },
  };
}

export function getFocusableDialogElements(dialog) {
  if (!dialog || typeof dialog.querySelectorAll !== "function") {
    return [];
  }

  return Array.from(dialog.querySelectorAll(focusableSelector)).filter((element) => {
    const disabled = element.disabled || element.getAttribute("aria-disabled") === "true";
    const hidden = element.hidden || element.getAttribute("aria-hidden") === "true";
    return !disabled && !hidden;
  });
}

export function trapConfirmDialogFocus(event, dialog) {
  if (!event || event.key !== "Tab" || !dialog) {
    return false;
  }

  const focusable = getFocusableDialogElements(dialog);
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus?.();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = dialog.ownerDocument?.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }

  return false;
}
