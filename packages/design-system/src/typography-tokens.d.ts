export type FontFamilyName = "base" | "ja";
export type TypographyName =
  | "h1"
  | "h2"
  | "body3Strong"
  | "body3"
  | "title1Strong"
  | "title2Strong"
  | "title"
  | "subtitle"
  | "bodyStrong"
  | "body1"
  | "subtitle2Strong"
  | "subtitle2"
  | "body2"
  | "buttonXl"
  | "buttonL"
  | "buttonM"
  | "buttonS"
  | "buttonSStrong"
  | "captionStrong"
  | "caption"
  | "overlineStrong"
  | "overline";

export interface TypographyStyle {
  readonly figmaStyle: string;
  readonly fontFamily: FontFamilyName;
  readonly fontWeight: 400 | 500 | 700;
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly letterSpacing: string;
}

export interface ResolvedTypographyStyle extends Omit<TypographyStyle, "fontFamily"> {
  readonly fontFamily: string;
}

export declare const fontFamilies: Readonly<Record<FontFamilyName, string>>;
export declare const typographyScale: Readonly<Record<TypographyName, TypographyStyle>>;
export declare const typographyCssVariables: Readonly<Record<string, string>>;
export declare function getTypographyStyle(name: TypographyName): ResolvedTypographyStyle;
export declare function toTypographyCss(name: TypographyName): Omit<ResolvedTypographyStyle, "figmaStyle">;
export declare function toTypographyCssVariableMap(): Readonly<Record<string, string>>;
