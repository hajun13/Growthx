export const colorPrimitives = Object.freeze({
  base: Object.freeze({
    black: "#000000",
    white: "#FFFFFF",
  }),
  mono: Object.freeze({
    100: "#191819",
    90: "#2F2F30",
    80: "#454547",
    70: "#5C5B5E",
    60: "#727174",
    50: "#88878B",
    40: "#9F9DA1",
    30: "#B4B4B6",
    20: "#CDCCCF",
    10: "#EBEAEC",
    "05": "#F6F6F6",
  }),
  primary: Object.freeze({
    100: "#1A0931",
    90: "#331360",
    80: "#4C1E8B",
    70: "#632AB3",
    60: "#7A37D8",
    50: "#8C5ECE",
    40: "#A183CB",
    30: "#B7A6CF",
    20: "#E5E1EC",
    10: "#F7F6F8",
    "05": "#FAFAFA",
  }),
  secondary: Object.freeze({
    100: "#032C29",
    90: "#0C5450",
    80: "#1C7B75",
    70: "#329E97",
    60: "#4DBFB8",
    50: "#76C5C0",
    40: "#9ACDCA",
    30: "#BAD7D5",
    20: "#D5E3E2",
    10: "#EDF0F0",
    "05": "#F9FAFA",
  }),
  red: Object.freeze({
    100: "#B22C3C",
    80: "#D93649",
    60: "#FF3F56",
    40: "#FF7989",
    20: "#FF9FAA",
    10: "#FFF9FA",
  }),
  green: Object.freeze({
    100: "#369165",
    80: "#41B07A",
    60: "#4DCF90",
    40: "#82DDB1",
    20: "#A6E7C7",
    10: "#FAFEFC",
  }),
  yellow: Object.freeze({
    100: "#B27B2D",
    80: "#D99636",
    60: "#FFB040",
    40: "#FFC879",
    20: "#FFD79F",
    10: "#FFFDF9",
  }),
  blue: Object.freeze({
    100: "#2D62B2",
    80: "#3677D9",
    60: "#408CFF",
    40: "#79AEFF",
    20: "#9FC5FF",
    10: "#F9FCFF",
  }),
});

export const glass2026Primitives = Object.freeze({
  neutral0: "#FFFFFF",
  neutral50: "#F8FAFC",
  neutral100: "#EEF2F7",
  neutral900: "#0B1020",
  neutral950: "#050816",
  aqua400: "#38D5E6",
  blue500: "#3B82F6",
  violet500: "#8B5CF6",
  lime400: "#A3E635",
  amber300: "#FCD34D",
  rose400: "#FB7185",
});

export const semanticColorModes = Object.freeze({
  light: Object.freeze({
    surfaceCanvas: glass2026Primitives.neutral50,
    surfaceGlass: "#FFFFFF8A",
    textPrimary: glass2026Primitives.neutral950,
    textSecondary: "#475569",
    accentPrimary: glass2026Primitives.blue500,
    accentWarm: glass2026Primitives.amber300,
  }),
  dark: Object.freeze({
    surfaceCanvas: glass2026Primitives.neutral950,
    surfaceGlass: "#11182794",
    textPrimary: glass2026Primitives.neutral0,
    textSecondary: "#CBD5E1",
    accentPrimary: glass2026Primitives.aqua400,
    accentWarm: glass2026Primitives.lime400,
  }),
  highContrast: Object.freeze({
    surfaceCanvas: glass2026Primitives.neutral0,
    surfaceGlass: "#FFFFFFEB",
    textPrimary: glass2026Primitives.neutral950,
    textSecondary: glass2026Primitives.neutral900,
    accentPrimary: glass2026Primitives.blue500,
    accentWarm: glass2026Primitives.rose400,
  }),
});

export const semanticColorCssVariables = Object.freeze({
  surfaceCanvas: "--color-surface-canvas",
  surfaceGlass: "--color-surface-glass",
  textPrimary: "--color-text-primary",
  textSecondary: "--color-text-secondary",
  accentPrimary: "--color-accent-primary",
  accentWarm: "--color-accent-warm",
});

export function getSemanticColors(mode = "light") {
  if (!(mode in semanticColorModes)) {
    throw new Error(`Unknown color mode: ${mode}`);
  }

  return semanticColorModes[mode];
}

export function toCssVariableMap(mode = "light") {
  const colors = getSemanticColors(mode);
  return Object.fromEntries(
    Object.entries(semanticColorCssVariables).map(([key, cssVariable]) => [
      cssVariable,
      colors[key],
    ]),
  );
}
