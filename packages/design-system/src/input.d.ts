export type TextFieldSize = "desktop" | "mobile";
export type TextFieldVariant = "textfield" | "select";
export type TextFieldState = "enabled" | "focused" | "error" | "disabled";

export type TextFieldA11yOptions = {
  id?: string;
  helperText?: string;
  errorText?: string;
  describedBy?: string | string[];
  invalid?: boolean;
};

export type TextFieldClassOptions = {
  size?: TextFieldSize;
  variant?: TextFieldVariant;
  invalid?: boolean;
  disabled?: boolean;
  prefix?: unknown;
  suffix?: unknown;
  counter?: boolean;
  multiline?: boolean;
};

export const inputFigmaSource: {
  nodeId: "1:22980";
  board: "10 input";
  component: "asset/input";
  variantAxes: string[];
};

export const inputSizes: Record<TextFieldSize, { height: number; minWidth: number }>;
export const inputStates: TextFieldState[];
export const inputVariants: TextFieldVariant[];

export function getTextFieldA11y(options?: TextFieldA11yOptions): {
  "aria-invalid": "true" | undefined;
  "aria-describedby": string | undefined;
};

export function getTextFieldClasses(options?: TextFieldClassOptions): string;
