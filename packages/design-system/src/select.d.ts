export type SelectSize = "sm" | "md" | "lg";
export type SelectInteractionState =
  | "default"
  | "hover"
  | "focus"
  | "open"
  | "invalid"
  | "disabled";

export type SelectValue = string | number;

export type SelectOption = {
  id?: string;
  value: SelectValue;
  disabled?: boolean;
};

export type SelectProps = {
  size?: SelectSize;
  open?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  multiple?: boolean;
  placeholder?: string;
  listboxId?: string;
  activeOptionId?: string;
};

export type SelectKeyboardState = {
  open: boolean;
  value?: SelectValue;
  highlightedValue?: SelectValue;
};

export declare const selectSizes: readonly SelectSize[];
export declare const selectInteractionStates: readonly SelectInteractionState[];
export declare function normalizeSelectProps(props?: SelectProps): Required<Pick<SelectProps, "size" | "open" | "disabled" | "invalid" | "multiple" | "placeholder">>;
export declare function getSelectClassNames(props?: SelectProps): string;
export declare function getSelectAriaProps(props?: SelectProps): {
  trigger: Record<string, string | number | undefined>;
  listbox: Record<string, string | undefined>;
};
export declare function getOptionAriaProps(
  option: SelectOption,
  context?: { value?: SelectValue | SelectValue[]; highlightedValue?: SelectValue },
): Record<string, string | undefined>;
export declare function getNextEnabledOptionIndex(
  options: readonly SelectOption[],
  currentIndex: number,
  direction: "next" | "previous",
): number;
export declare function reduceSelectKeyboardState(
  state: SelectKeyboardState,
  key: string,
  options: readonly SelectOption[],
): SelectKeyboardState;
