export const fontFamilies = Object.freeze({
  base: '"Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  ja: '"Pretendard JP", "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
});

export const typographyScale = Object.freeze({
  h1: Object.freeze({
    figmaStyle: "V2/H1",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "38px",
    lineHeight: "54px",
    letterSpacing: "-0.5px",
  }),
  h2: Object.freeze({
    figmaStyle: "V2/H2",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "30px",
    lineHeight: "46px",
    letterSpacing: "-0.5px",
  }),
  body3Strong: Object.freeze({
    figmaStyle: "V2/Body3_h",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "22px",
    lineHeight: "34px",
    letterSpacing: "-0.2px",
  }),
  body3: Object.freeze({
    figmaStyle: "V2/Body3",
    fontFamily: "base",
    fontWeight: 400,
    fontSize: "22px",
    lineHeight: "34px",
    letterSpacing: "-0.2px",
  }),
  title1Strong: Object.freeze({
    figmaStyle: "V2/Title1_h",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "20px",
    lineHeight: "32px",
    letterSpacing: "0px",
  }),
  title2Strong: Object.freeze({
    figmaStyle: "V2/Title2_h",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "18px",
    lineHeight: "28px",
    letterSpacing: "-0.2px",
  }),
  title: Object.freeze({
    figmaStyle: "Title",
    fontFamily: "base",
    fontWeight: 500,
    fontSize: "18px",
    lineHeight: "28px",
    letterSpacing: "-0.2px",
  }),
  subtitle: Object.freeze({
    figmaStyle: "Subtitle",
    fontFamily: "base",
    fontWeight: 500,
    fontSize: "16px",
    lineHeight: "24px",
    letterSpacing: "0px",
  }),
  bodyStrong: Object.freeze({
    figmaStyle: "Body_h",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "16px",
    lineHeight: "24px",
    letterSpacing: "0px",
  }),
  body1: Object.freeze({
    figmaStyle: "Body1",
    fontFamily: "base",
    fontWeight: 400,
    fontSize: "16px",
    lineHeight: "24px",
    letterSpacing: "-0.1px",
  }),
  subtitle2Strong: Object.freeze({
    figmaStyle: "v2/Subtitle2_h",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "14px",
    lineHeight: "20px",
    letterSpacing: "0px",
  }),
  subtitle2: Object.freeze({
    figmaStyle: "V2/Subtitle2",
    fontFamily: "base",
    fontWeight: 400,
    fontSize: "14px",
    lineHeight: "20px",
    letterSpacing: "0px",
  }),
  body2: Object.freeze({
    figmaStyle: "Body2",
    fontFamily: "base",
    fontWeight: 500,
    fontSize: "13px",
    lineHeight: "18px",
    letterSpacing: "0px",
  }),
  buttonXl: Object.freeze({
    figmaStyle: "v2/Button_xl",
    fontFamily: "base",
    fontWeight: 500,
    fontSize: "18px",
    lineHeight: "28px",
    letterSpacing: "-0.25px",
  }),
  buttonL: Object.freeze({
    figmaStyle: "v2/Button_l",
    fontFamily: "base",
    fontWeight: 500,
    fontSize: "16px",
    lineHeight: "28px",
    letterSpacing: "0px",
  }),
  buttonM: Object.freeze({
    figmaStyle: "v2/Button_m",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "14px",
    lineHeight: "20px",
    letterSpacing: "0.2px",
  }),
  buttonS: Object.freeze({
    figmaStyle: "V2/Button_s",
    fontFamily: "base",
    fontWeight: 500,
    fontSize: "13px",
    lineHeight: "20px",
    letterSpacing: "-0.2px",
  }),
  buttonSStrong: Object.freeze({
    figmaStyle: "v2/Button_s_h",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "13px",
    lineHeight: "20px",
    letterSpacing: "0.1px",
  }),
  captionStrong: Object.freeze({
    figmaStyle: "Caption_h",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "12px",
    lineHeight: "18px",
    letterSpacing: "0px",
  }),
  caption: Object.freeze({
    figmaStyle: "Caption",
    fontFamily: "base",
    fontWeight: 400,
    fontSize: "12px",
    lineHeight: "18px",
    letterSpacing: "0px",
  }),
  overlineStrong: Object.freeze({
    figmaStyle: "v2/overline_h",
    fontFamily: "base",
    fontWeight: 700,
    fontSize: "10px",
    lineHeight: "14px",
    letterSpacing: "0.1px",
  }),
  overline: Object.freeze({
    figmaStyle: "overline",
    fontFamily: "base",
    fontWeight: 400,
    fontSize: "10px",
    lineHeight: "14px",
    letterSpacing: "0px",
  }),
});

export const typographyCssVariables = Object.freeze(
  Object.fromEntries(
    Object.keys(typographyScale).flatMap((name) => [
      [name, `--typography-v2-${toKebabCase(name)}`],
      [`${name}LetterSpacing`, `--typography-v2-${toKebabCase(name)}-letter-spacing`],
    ]),
  ),
);

export function getTypographyStyle(name) {
  if (!(name in typographyScale)) {
    throw new Error(`Unknown typography style: ${name}`);
  }

  const style = typographyScale[name];
  return Object.freeze({
    ...style,
    fontFamily: fontFamilies[style.fontFamily],
  });
}

export function toTypographyCss(name) {
  const style = getTypographyStyle(name);
  return Object.freeze({
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
  });
}

export function toTypographyCssVariableMap() {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(typographyScale).flatMap(([name, style]) => {
        const variableName = `--typography-v2-${toKebabCase(name)}`;
        return [
          [variableName, `${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${fontFamilies[style.fontFamily]}`],
          [`${variableName}-letter-spacing`, style.letterSpacing],
        ];
      }),
    ),
  );
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
