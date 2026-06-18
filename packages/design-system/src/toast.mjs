export const toastStatuses = ["normal", "warn", "error", "pass"];
export const toastLines = ["single", "double"];
export const toastActions = ["none", "normal", "longer"];
export const toastPlacements = ["top-center", "bottom-center"];
export const toastViewports = ["desktop", "tablet", "mobile"];

export const toastDefaults = {
  status: "normal",
  line: "single",
  action: "none",
  placement: "top-center",
  viewport: "desktop",
  duration: 2000,
  icon: false,
  close: false,
  open: true,
};

function assertOneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${name} must be one of: ${allowed.join(", ")}`);
  }
}

function normalizePlacement({ placement, viewport }) {
  if (placement) {
    assertOneOf("placement", placement, toastPlacements);
    return placement;
  }

  if (viewport !== undefined) {
    assertOneOf("viewport", viewport, toastViewports);
  }

  return viewport === "tablet" || viewport === "mobile" ? "bottom-center" : toastDefaults.placement;
}

export function getToastLine(message = "") {
  return String(message).includes("\n") ? "double" : "single";
}

export function getToastAction(action) {
  if (!action) return "none";
  if (typeof action === "string") return action.length > 8 ? "longer" : "normal";
  if (typeof action === "object" && action.variant) return action.variant;
  return "normal";
}

export function getToastLiveRegionProps({ status = toastDefaults.status, atomic = true } = {}) {
  assertOneOf("status", status, toastStatuses);

  return {
    role: status === "error" ? "alert" : "status",
    "aria-live": status === "error" ? "assertive" : "polite",
    "aria-atomic": atomic ? "true" : "false",
  };
}

export function getToastClasses({
  status = toastDefaults.status,
  line = toastDefaults.line,
  action = toastDefaults.action,
  placement,
  viewport = toastDefaults.viewport,
  icon = toastDefaults.icon,
  close = toastDefaults.close,
  open = toastDefaults.open,
  className = "",
} = {}) {
  assertOneOf("status", status, toastStatuses);
  assertOneOf("line", line, toastLines);
  assertOneOf("action", action, toastActions);
  assertOneOf("viewport", viewport, toastViewports);

  const resolvedPlacement = normalizePlacement({ placement, viewport });

  return [
    "ds-toast",
    `ds-toast--${status}`,
    `ds-toast--${line}`,
    `ds-toast--action-${action}`,
    `ds-toast--${resolvedPlacement}`,
    icon ? "ds-toast--with-icon" : "",
    close ? "ds-toast--closable" : "",
    open ? "ds-toast--open" : "",
    className,
  ].filter(Boolean).join(" ");
}

export function getToastProps({
  id,
  message,
  status = toastDefaults.status,
  line = message ? getToastLine(message) : toastDefaults.line,
  action = toastDefaults.action,
  placement,
  viewport = toastDefaults.viewport,
  duration = toastDefaults.duration,
  icon = toastDefaults.icon,
  close = toastDefaults.close,
  open = toastDefaults.open,
  className = "",
} = {}) {
  return {
    id,
    className: getToastClasses({ status, line, action, placement, viewport, icon, close, open, className }),
    "data-status": status,
    "data-line": line,
    "data-action": action,
    "data-duration": String(Number(duration)),
    "data-open": open ? "true" : "false",
    ...getToastLiveRegionProps({ status }),
  };
}

export function getToastViewportProps({
  id,
  viewport = toastDefaults.viewport,
  placement,
  hasBottomBar = false,
  className = "",
} = {}) {
  assertOneOf("viewport", viewport, toastViewports);
  const resolvedPlacement = normalizePlacement({ placement, viewport });

  return {
    id,
    className: [
      "ds-toast-viewport",
      `ds-toast-viewport--${resolvedPlacement}`,
      `ds-toast-viewport--${viewport}`,
      hasBottomBar ? "ds-toast-viewport--with-bottom-bar" : "",
      className,
    ].filter(Boolean).join(" "),
  };
}

export function getToastDurationVars({ duration = toastDefaults.duration, fadeDuration = 120 } = {}) {
  return {
    "--toast-duration": `${Number(duration)}ms`,
    "--toast-fade-duration": `${Number(fadeDuration)}ms`,
  };
}
