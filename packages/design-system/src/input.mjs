export const inputFigmaSource = {
  nodeId: "1:22980",
  board: "10 input",
  component: "asset/input",
  variantAxes: [
    "style",
    "state",
    "label display",
    "first icon",
    "secondicon",
    "counter limit",
    "input line",
    "device",
    "typing state",
  ],
};

export const inputSizes = {
  desktop: { height: 60, minWidth: 270 },
  mobile: { height: 50, minWidth: 270 },
};

export const inputStates = ["enabled", "focused", "error", "disabled"];
export const inputVariants = ["textfield", "select"];

export function getTextFieldA11y({
  id,
  helperText,
  errorText,
  describedBy,
  invalid = Boolean(errorText),
} = {}) {
  const ids = [describedBy, helperText ? `${id}-helper` : undefined, errorText ? `${id}-error` : undefined]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean);

  return {
    "aria-invalid": invalid ? "true" : undefined,
    "aria-describedby": ids.length ? Array.from(new Set(ids)).join(" ") : undefined,
  };
}

export function getTextFieldClasses({
  size = "desktop",
  variant = "textfield",
  invalid = false,
  disabled = false,
  prefix,
  suffix,
  counter,
  multiline = false,
} = {}) {
  return [
    "text-field",
    `text-field--${size}`,
    `text-field--${variant}`,
    invalid ? "text-field--error" : undefined,
    disabled ? "text-field--disabled" : undefined,
    prefix ? "text-field--with-prefix" : undefined,
    suffix ? "text-field--with-suffix" : undefined,
    counter ? "text-field--with-counter" : undefined,
    multiline ? "text-field--multiline" : undefined,
  ].filter(Boolean).join(" ");
}
