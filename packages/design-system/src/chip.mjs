export const labelTones = ["primary", "darkgray", "secondary", "red", "lightgray"];
export const labelVariants = ["fill", "border"];
export const hashtagChipKinds = ["toggle", "user"];
export const hashtagLabelTones = ["default", "partner"];

function assertOneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${name} must be one of: ${allowed.join(", ")}`);
  }
}

export function getLabelClasses({
  tone = "primary",
  variant = "fill",
  className = "",
} = {}) {
  assertOneOf("tone", tone, labelTones);
  assertOneOf("variant", variant, labelVariants);

  return [
    "ds-label",
    `ds-label--${variant}`,
    `ds-label--${tone}`,
    className,
  ].filter(Boolean).join(" ");
}

export function getHashtagChipClasses({
  kind = "toggle",
  selected = false,
  removable,
  after = false,
  leadingIcon,
  className = "",
} = {}) {
  assertOneOf("kind", kind, hashtagChipKinds);

  const isToggle = kind === "toggle";
  const isAfter = Boolean(after);
  const hasLeadingIcon = isToggle ? leadingIcon !== false : Boolean(leadingIcon);
  const hasRemoveAction = kind === "user" && !isAfter && removable !== false;

  return [
    "ds-hashtag-chip",
    kind === "user" ? "ds-hashtag-chip--user" : "",
    selected ? "ds-hashtag-chip--selected" : "",
    isAfter ? "ds-hashtag-chip--after" : "",
    hasLeadingIcon ? "ds-hashtag-chip--with-leading-icon" : "",
    hasRemoveAction ? "ds-hashtag-chip--removable" : "",
    className,
  ].filter(Boolean).join(" ");
}

export function getHashtagChipAriaProps({
  kind = "toggle",
  selected = false,
  disabled = false,
} = {}) {
  assertOneOf("kind", kind, hashtagChipKinds);

  if (kind === "toggle") {
    return {
      "aria-pressed": String(Boolean(selected)),
      ...(disabled ? { disabled: true } : {}),
    };
  }

  return disabled ? { "aria-disabled": "true" } : {};
}

export function getHashtagLabelClasses({
  tone = "default",
  className = "",
} = {}) {
  assertOneOf("tone", tone, hashtagLabelTones);

  return [
    "ds-hashtag-label",
    tone === "partner" ? "ds-hashtag-label--partner" : "",
    className,
  ].filter(Boolean).join(" ");
}

export function getValueChipClasses({ className = "" } = {}) {
  return ["ds-value-chip", className].filter(Boolean).join(" ");
}
