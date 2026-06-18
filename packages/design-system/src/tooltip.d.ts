export type TooltipPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";
export type TooltipTone = "dark" | "light";

export type TooltipClassOptions = {
  placement?: TooltipPlacement;
  tone?: TooltipTone;
  arrow?: boolean;
  open?: boolean;
  className?: string;
};

export type TooltipRootOptions = TooltipClassOptions & {
  id?: string;
};

export type TooltipTriggerOptions = {
  id?: string;
  describedBy?: string;
  interactive?: boolean;
  open?: boolean;
};

export type TooltipBubbleOptions = {
  id?: string;
  interactive?: boolean;
};

export type TooltipDelayOptions = {
  showDelay?: number;
  hideDelay?: number;
};

export declare const tooltipPlacements: TooltipPlacement[];
export declare const tooltipTones: TooltipTone[];
export declare function getTooltipClasses(options?: TooltipClassOptions): string;
export declare function getTooltipRootProps(options?: TooltipRootOptions): Record<string, string>;
export declare function getTooltipTriggerProps(options?: TooltipTriggerOptions): Record<string, string | boolean | undefined>;
export declare function getTooltipBubbleProps(options?: TooltipBubbleOptions): Record<string, string | undefined>;
export declare function getTooltipDelayVars(options?: TooltipDelayOptions): Record<string, string>;
