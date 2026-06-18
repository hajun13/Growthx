export const buttonVariants = ["contained", "outlined", "text"];
export const buttonSizes = ["sm", "md", "lg"];
export const buttonServices = ["default", "kakao", "naver", "google", "apple"];

function assertOneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${name} must be one of: ${allowed.join(", ")}`);
  }
}

export function getButtonClasses({
  variant = "contained",
  size = "md",
  service = "default",
  disabled = false,
  leftIcon = false,
  rightIcon = false,
  children = true,
  className = "",
} = {}) {
  assertOneOf("variant", variant, buttonVariants);
  assertOneOf("size", size, buttonSizes);
  assertOneOf("service", service, buttonServices);

  const hasIcon = Boolean(leftIcon || rightIcon);
  const hasText = Boolean(children);
  const visualClass = service === "default" ? `button--${variant}` : `button--service-${service}`;

  return [
    "button",
    `button--${size}`,
    visualClass,
    disabled ? "button--disabled" : "",
    hasIcon && !hasText ? "button--icon-only" : "",
    className,
  ].filter(Boolean).join(" ");
}

export function getButtonAriaProps({ disabled = false, as = "button" } = {}) {
  if (as === "button") {
    return { disabled: Boolean(disabled) };
  }

  return disabled ? { "aria-disabled": "true", tabIndex: -1 } : {};
}
