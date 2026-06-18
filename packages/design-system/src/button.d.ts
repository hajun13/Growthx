export type ButtonVariant = "contained" | "outlined" | "text";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonService = "default" | "kakao" | "naver" | "google" | "apple";

export type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  service?: ButtonService;
  disabled?: boolean;
  leftIcon?: unknown;
  rightIcon?: unknown;
  children?: unknown;
  className?: string;
};

export type ButtonAriaOptions = {
  disabled?: boolean;
  as?: "button" | "a" | string;
};

export declare const buttonVariants: ButtonVariant[];
export declare const buttonSizes: ButtonSize[];
export declare const buttonServices: ButtonService[];
export declare function getButtonClasses(options?: ButtonClassOptions): string;
export declare function getButtonAriaProps(options?: ButtonAriaOptions): Record<string, boolean | string | number>;
