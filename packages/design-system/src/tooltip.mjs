export const tooltipPlacements = ["bottom-start", "bottom-end", "top-start", "top-end"];
export const tooltipTones = ["dark", "light"];

const defaults = {
  placement: "bottom-start",
  tone: "dark",
  arrow: false,
};

function assertOneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${name} must be one of: ${allowed.join(", ")}`);
  }
}

export function getTooltipClasses({
  placement = defaults.placement,
  tone = defaults.tone,
  arrow = defaults.arrow,
  open = false,
  className = "",
} = {}) {
  assertOneOf("placement", placement, tooltipPlacements);
  assertOneOf("tone", tone, tooltipTones);

  return [
    "ds-tooltip",
    `ds-tooltip--${placement}`,
    `ds-tooltip--${tone}`,
    arrow ? "ds-tooltip--with-arrow" : "",
    open ? "ds-tooltip--open" : "",
    className,
  ].filter(Boolean).join(" ");
}

export function getTooltipRootProps({
  id,
  placement = defaults.placement,
  tone = defaults.tone,
  arrow = defaults.arrow,
  open,
  className = "",
} = {}) {
  const props = {
    className: getTooltipClasses({ placement, tone, arrow, open, className }),
  };

  if (open !== undefined) {
    props["data-open"] = open ? "true" : "false";
  }

  if (id) {
    props["data-tooltip-id"] = id;
  }

  return props;
}

export function getTooltipTriggerProps({ id, describedBy, interactive = false, open = false } = {}) {
  const tooltipId = describedBy || id;
  const props = {
    "aria-describedby": tooltipId,
    type: "button",
  };

  if (interactive) {
    props["aria-expanded"] = Boolean(open);
    props["aria-haspopup"] = "dialog";
  }

  return props;
}

export function getTooltipBubbleProps({ id, interactive = false } = {}) {
  return {
    id,
    role: interactive ? "dialog" : "tooltip",
  };
}

export function getTooltipDelayVars({ showDelay = 150, hideDelay = 100 } = {}) {
  return {
    "--tooltip-show-delay": `${Number(showDelay)}ms`,
    "--tooltip-hide-delay": `${Number(hideDelay)}ms`,
  };
}
