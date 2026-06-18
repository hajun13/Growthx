export type ColorMode = "light" | "dark" | "highContrast";
export type SemanticColorName =
  | "surfaceCanvas"
  | "surfaceGlass"
  | "textPrimary"
  | "textSecondary"
  | "accentPrimary"
  | "accentWarm";

export declare const colorPrimitives: Readonly<Record<string, Readonly<Record<string, string>>>>;
export declare const glass2026Primitives: Readonly<Record<string, string>>;
export declare const semanticColorModes: Readonly<Record<ColorMode, Readonly<Record<SemanticColorName, string>>>>;
export declare const semanticColorCssVariables: Readonly<Record<SemanticColorName, string>>;
export declare function getSemanticColors(mode?: ColorMode): Readonly<Record<SemanticColorName, string>>;
export declare function toCssVariableMap(mode?: ColorMode): Record<string, string>;
