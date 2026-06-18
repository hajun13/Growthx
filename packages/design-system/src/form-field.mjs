export const formFieldMessageTones = ["none", "helper", "error"];
export const formFieldButtonLayouts = ["none", "single", "double"];

function assertOneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new TypeError(`${name} must be one of: ${allowed.join(", ")}`);
  }
}

export function getFormFieldMessageTone({ errorMessage, helperText, messageTone } = {}) {
  if (messageTone !== undefined) {
    assertOneOf("messageTone", messageTone, formFieldMessageTones);
    return messageTone;
  }

  if (errorMessage) return "error";
  if (helperText) return "helper";
  return "none";
}

export function getFormFieldClasses({
  required = false,
  disabled = false,
  invalid = false,
  hasUnit = false,
  buttonLayout = "none",
  messageTone,
  helperText,
  errorMessage,
  className = "",
} = {}) {
  assertOneOf("buttonLayout", buttonLayout, formFieldButtonLayouts);
  const tone = getFormFieldMessageTone({ errorMessage, helperText, messageTone });

  return [
    "form-field",
    required ? "form-field--required" : "",
    disabled ? "form-field--disabled" : "",
    invalid || tone === "error" ? "form-field--invalid" : "",
    hasUnit ? "form-field--with-unit" : "",
    buttonLayout !== "none" ? `form-field--button-${buttonLayout}` : "",
    tone !== "none" ? `form-field--message-${tone}` : "",
    className,
  ].filter(Boolean).join(" ");
}

export function getFormGroupClasses({
  direction = "vertical",
  columns = 1,
  className = "",
} = {}) {
  assertOneOf("direction", direction, ["vertical", "horizontal"]);

  if (!Number.isInteger(columns) || columns < 1) {
    throw new TypeError("columns must be a positive integer");
  }

  return [
    "form-group",
    `form-group--${direction}`,
    columns > 1 ? `form-group--cols-${columns}` : "",
    className,
  ].filter(Boolean).join(" ");
}

export function getFormFieldA11yProps({
  id,
  required = false,
  disabled = false,
  invalid = false,
  helperId,
  errorId,
  helperText,
  errorMessage,
} = {}) {
  const describedBy = [];
  const tone = getFormFieldMessageTone({ helperText, errorMessage });

  if (tone === "error" && errorId) {
    describedBy.push(errorId);
  } else if (tone === "helper" && helperId) {
    describedBy.push(helperId);
  }

  return {
    ...(id ? { id } : {}),
    ...(required ? { "aria-required": "true" } : {}),
    ...(disabled ? { disabled: true } : {}),
    ...(invalid || tone === "error" ? { "aria-invalid": "true" } : {}),
    ...(describedBy.length ? { "aria-describedby": describedBy.join(" ") } : {}),
  };
}
