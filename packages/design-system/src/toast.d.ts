export type ToastStatus = "normal" | "warn" | "error" | "pass";
export type ToastLine = "single" | "double";
export type ToastAction = "none" | "normal" | "longer";
export type ToastPlacement = "top-center" | "bottom-center";
export type ToastViewport = "desktop" | "tablet" | "mobile";

export type ToastClassOptions = {
  status?: ToastStatus;
  line?: ToastLine;
  action?: ToastAction;
  placement?: ToastPlacement;
  viewport?: ToastViewport;
  icon?: boolean;
  close?: boolean;
  open?: boolean;
  className?: string;
};

export type ToastPropsOptions = ToastClassOptions & {
  id?: string;
  message?: string;
  duration?: number;
};

export type ToastLiveRegionOptions = {
  status?: ToastStatus;
  atomic?: boolean;
};

export type ToastViewportOptions = {
  id?: string;
  viewport?: ToastViewport;
  placement?: ToastPlacement;
  hasBottomBar?: boolean;
  className?: string;
};

export type ToastDurationOptions = {
  duration?: number;
  fadeDuration?: number;
};

export declare const toastStatuses: ToastStatus[];
export declare const toastLines: ToastLine[];
export declare const toastActions: ToastAction[];
export declare const toastPlacements: ToastPlacement[];
export declare const toastViewports: ToastViewport[];
export declare const toastDefaults: {
  status: ToastStatus;
  line: ToastLine;
  action: ToastAction;
  placement: ToastPlacement;
  viewport: ToastViewport;
  duration: number;
  icon: boolean;
  close: boolean;
  open: boolean;
};
export declare function getToastLine(message?: string): ToastLine;
export declare function getToastAction(action?: string | { variant?: ToastAction } | null): ToastAction;
export declare function getToastLiveRegionProps(options?: ToastLiveRegionOptions): Record<string, string>;
export declare function getToastClasses(options?: ToastClassOptions): string;
export declare function getToastProps(options?: ToastPropsOptions): Record<string, string | undefined>;
export declare function getToastViewportProps(options?: ToastViewportOptions): Record<string, string | undefined>;
export declare function getToastDurationVars(options?: ToastDurationOptions): Record<string, string>;
