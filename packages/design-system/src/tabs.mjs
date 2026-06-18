export const tabVariants = Object.freeze(["underline", "box", "box-border", "box-basic"]);
export const tabSizes = Object.freeze(["s", "l"]);
export const tabOrientations = Object.freeze(["horizontal", "vertical"]);

export function normalizeTabsProps(props = {}) {
  const variant = props.variant ?? "underline";
  const size = props.size ?? "s";
  const orientation = props.orientation ?? "horizontal";

  if (!tabVariants.includes(variant)) {
    throw new Error(`Unknown tabs variant: ${variant}`);
  }

  if (!tabSizes.includes(size)) {
    throw new Error(`Unknown tabs size: ${size}`);
  }

  if (!tabOrientations.includes(orientation)) {
    throw new Error(`Unknown tabs orientation: ${orientation}`);
  }

  const items = Array.isArray(props.items) ? props.items : [];
  const firstEnabled = items.find((item) => !item.disabled);
  const value = props.value ?? firstEnabled?.id ?? items[0]?.id;

  return {
    variant,
    size,
    orientation,
    value,
    items,
    activation: props.activation ?? "automatic",
  };
}

export function getTabsClassNames(props = {}) {
  const normalized = normalizeTabsProps(props);
  return [
    "tabs",
    `tabs--${normalized.variant}`,
    `tabs--${normalized.size}`,
    `tabs--${normalized.orientation}`,
  ].join(" ");
}

export function getTabsRootProps(props = {}) {
  const normalized = normalizeTabsProps(props);
  return {
    className: getTabsClassNames(normalized),
    "data-type": normalized.variant,
    "data-size": normalized.size,
    "data-orientation": normalized.orientation,
    role: "tablist",
    "aria-orientation": normalized.orientation,
  };
}

export function getTabProps(item, context = {}) {
  const normalized = normalizeTabsProps(context);
  const selected = item.id === normalized.value;
  const disabled = Boolean(item.disabled);
  const tabId = item.tabId ?? `tab-${item.id}`;
  const panelId = item.panelId ?? `panel-${item.id}`;

  return {
    id: tabId,
    className: "tabs__tab",
    role: "tab",
    type: "button",
    disabled,
    "aria-selected": String(selected),
    "aria-controls": panelId,
    "aria-disabled": disabled ? "true" : undefined,
    tabIndex: selected && !disabled ? 0 : -1,
    "data-state": selected ? "pressed" : "enable",
    "data-badge": item.badge ? "on" : "off",
  };
}

export function getTabPanelProps(item, context = {}) {
  const normalized = normalizeTabsProps(context);
  const selected = item.id === normalized.value;
  const tabId = item.tabId ?? `tab-${item.id}`;
  const panelId = item.panelId ?? `panel-${item.id}`;

  return {
    id: panelId,
    className: "tabs__panel",
    role: "tabpanel",
    "aria-labelledby": tabId,
    hidden: selected ? undefined : true,
    tabIndex: 0,
  };
}

export function getNextEnabledTabIndex(items, currentIndex, direction) {
  if (!items.length) {
    return -1;
  }

  const step = direction === "previous" ? -1 : 1;
  for (let offset = 1; offset <= items.length; offset += 1) {
    const nextIndex = (currentIndex + offset * step + items.length) % items.length;
    if (!items[nextIndex]?.disabled) {
      return nextIndex;
    }
  }

  return -1;
}

export function reduceTabsKeyboardState(state, key, items, options = {}) {
  const orientation = options.orientation ?? "horizontal";
  const activation = options.activation ?? "automatic";
  const currentIndex = Math.max(
    0,
    items.findIndex((item) => item.id === state.focusedValue),
  );
  const previousKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
  const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

  if (key === previousKey || key === nextKey) {
    const direction = key === previousKey ? "previous" : "next";
    const index = getNextEnabledTabIndex(items, currentIndex, direction);
    const focusedValue = items[index]?.id;
    return {
      ...state,
      focusedValue,
      value: activation === "automatic" ? focusedValue : state.value,
    };
  }

  if (key === "Home") {
    const item = items.find((candidate) => !candidate.disabled);
    return {
      ...state,
      focusedValue: item?.id,
      value: activation === "automatic" ? item?.id : state.value,
    };
  }

  if (key === "End") {
    const item = [...items].reverse().find((candidate) => !candidate.disabled);
    return {
      ...state,
      focusedValue: item?.id,
      value: activation === "automatic" ? item?.id : state.value,
    };
  }

  if (key === "Enter" || key === " ") {
    const item = items.find((candidate) => candidate.id === state.focusedValue);
    if (!item || item.disabled) {
      return state;
    }
    return { ...state, value: item.id };
  }

  return state;
}
