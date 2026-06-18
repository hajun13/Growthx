export const selectSizes = Object.freeze(["sm", "md", "lg"]);
export const selectInteractionStates = Object.freeze([
  "default",
  "hover",
  "focus",
  "open",
  "invalid",
  "disabled",
]);

export function normalizeSelectProps(props = {}) {
  const size = props.size ?? "md";
  if (!selectSizes.includes(size)) {
    throw new Error(`Unknown select size: ${size}`);
  }

  const disabled = Boolean(props.disabled);
  const invalid = Boolean(props.invalid);
  const open = !disabled && Boolean(props.open);

  return {
    size,
    open,
    disabled,
    invalid,
    multiple: Boolean(props.multiple),
    placeholder: props.placeholder ?? "Select an option",
  };
}

export function getSelectClassNames(props = {}) {
  const normalized = normalizeSelectProps(props);
  return [
    "select",
    `select--${normalized.size}`,
    normalized.open ? "select--open" : undefined,
    normalized.invalid ? "select--invalid" : undefined,
    normalized.disabled ? "select--disabled" : undefined,
    normalized.multiple ? "select--multiple" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

export function getSelectAriaProps(props = {}) {
  const normalized = normalizeSelectProps(props);
  const listboxId = props.listboxId;
  const activeOptionId = normalized.open ? props.activeOptionId : undefined;

  return {
    trigger: {
      "aria-controls": normalized.open ? listboxId : undefined,
      "aria-disabled": normalized.disabled ? "true" : undefined,
      "aria-expanded": String(normalized.open),
      "aria-haspopup": "listbox",
      "aria-invalid": normalized.invalid ? "true" : undefined,
      "aria-activedescendant": activeOptionId,
      role: "combobox",
      tabIndex: normalized.disabled ? -1 : 0,
    },
    listbox: {
      id: listboxId,
      role: "listbox",
      "aria-multiselectable": normalized.multiple ? "true" : undefined,
    },
  };
}

export function getOptionAriaProps(option, context = {}) {
  const selectedValues = new Set(
    Array.isArray(context.value) ? context.value : [context.value],
  );
  const selected = selectedValues.has(option.value);
  return {
    id: option.id,
    role: "option",
    "aria-disabled": option.disabled ? "true" : undefined,
    "aria-selected": String(selected),
    "data-highlighted": context.highlightedValue === option.value ? "true" : undefined,
  };
}

export function getNextEnabledOptionIndex(options, currentIndex, direction) {
  if (!options.length) {
    return -1;
  }

  const step = direction === "previous" ? -1 : 1;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const nextIndex = (currentIndex + offset * step + options.length) % options.length;
    if (!options[nextIndex]?.disabled) {
      return nextIndex;
    }
  }

  return -1;
}

export function reduceSelectKeyboardState(state, key, options) {
  const currentIndex = Math.max(
    0,
    options.findIndex((option) => option.value === state.highlightedValue),
  );

  if (key === "ArrowDown") {
    const index = getNextEnabledOptionIndex(options, state.open ? currentIndex : -1, "next");
    return { ...state, open: true, highlightedValue: options[index]?.value };
  }

  if (key === "ArrowUp") {
    const startIndex = state.open ? currentIndex : options.length;
    const index = getNextEnabledOptionIndex(options, startIndex, "previous");
    return { ...state, open: true, highlightedValue: options[index]?.value };
  }

  if (key === "Home") {
    const index = options.findIndex((option) => !option.disabled);
    return { ...state, open: true, highlightedValue: options[index]?.value };
  }

  if (key === "End") {
    const reversedIndex = [...options].reverse().findIndex((option) => !option.disabled);
    const index = reversedIndex === -1 ? -1 : options.length - 1 - reversedIndex;
    return { ...state, open: true, highlightedValue: options[index]?.value };
  }

  if (key === "Escape") {
    return { ...state, open: false };
  }

  if (key === "Enter" || key === " ") {
    if (!state.open) {
      return { ...state, open: true };
    }

    const option = options.find((item) => item.value === state.highlightedValue);
    if (!option || option.disabled) {
      return state;
    }

    return {
      ...state,
      open: false,
      value: option.value,
      highlightedValue: option.value,
    };
  }

  return state;
}
