export type LayoutBreakpointName = "mobile" | "tablet" | "desktop";

export type LayoutBreakpoint = Readonly<{
  min: number;
  max: number | null;
}>;

export type LayoutGridToken = Readonly<{
  breakpoint: LayoutBreakpointName;
  containerMin: number;
  containerMax: number | null;
  columns: number;
  offset: number;
  gutter: number;
}>;

export declare const layoutBreakpoints: Readonly<Record<LayoutBreakpointName, LayoutBreakpoint>>;
export declare const layoutGrid: Readonly<Record<LayoutBreakpointName, LayoutGridToken>>;
export declare const layoutCssVariables: Readonly<Record<string, string>>;
export declare function getLayoutBreakpoint(width: number): LayoutBreakpointName;
export declare function getLayoutGrid(width: number): LayoutGridToken;
export declare function toLayoutCssVariableMap(breakpoint?: LayoutBreakpointName): Record<string, string>;

