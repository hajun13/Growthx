export type FormFieldMessageTone = "none" | "helper" | "error";
export type FormFieldButtonLayout = "none" | "single" | "double";
export type FormGroupDirection = "vertical" | "horizontal";

export type FormFieldClassOptions = {
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  hasUnit?: boolean;
  buttonLayout?: FormFieldButtonLayout;
  messageTone?: FormFieldMessageTone;
  helperText?: unknown;
  errorMessage?: unknown;
  className?: string;
};

export type FormGroupClassOptions = {
  direction?: FormGroupDirection;
  columns?: number;
  className?: string;
};

export type FormFieldA11yOptions = {
  id?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  helperId?: string;
  errorId?: string;
  helperText?: unknown;
  errorMessage?: unknown;
};

export declare const formFieldMessageTones: FormFieldMessageTone[];
export declare const formFieldButtonLayouts: FormFieldButtonLayout[];
export declare function getFormFieldMessageTone(options?: Pick<FormFieldClassOptions, "messageTone" | "helperText" | "errorMessage">): FormFieldMessageTone;
export declare function getFormFieldClasses(options?: FormFieldClassOptions): string;
export declare function getFormGroupClasses(options?: FormGroupClassOptions): string;
export declare function getFormFieldA11yProps(options?: FormFieldA11yOptions): Record<string, boolean | string>;
