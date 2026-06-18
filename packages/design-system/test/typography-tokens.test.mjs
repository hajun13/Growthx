import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fontFamilies,
  getTypographyStyle,
  toTypographyCss,
  toTypographyCssVariableMap,
  typographyScale,
} from "../src/typography-tokens.mjs";

const communityTokenDocument = JSON.parse(readFileSync("design-tokens/typography.tokens.json", "utf8"));
const css = readFileSync("styles/typography.css", "utf8");

assert.equal(fontFamilies.base.includes("Pretendard"), true);
assert.equal(fontFamilies.ja.includes("Pretendard JP"), true);
assert.equal(Object.keys(typographyScale).length, 22);

assert.deepEqual(toTypographyCss("h1"), {
  fontFamily: fontFamilies.base,
  fontWeight: 700,
  fontSize: "38px",
  lineHeight: "54px",
  letterSpacing: "-0.5px",
});

assert.equal(getTypographyStyle("buttonM").figmaStyle, "v2/Button_m");
assert.equal(toTypographyCss("buttonM").letterSpacing, "0.2px");
assert.equal(toTypographyCss("body2").lineHeight, "18px");
assert.throws(() => getTypographyStyle("display"), /Unknown typography style/);

const cssVariables = toTypographyCssVariableMap();
assert.equal(cssVariables["--typography-v2-h1"], `700 38px / 54px ${fontFamilies.base}`);
assert.equal(cssVariables["--typography-v2-overline-letter-spacing"], "0px");
assert.equal(css.includes(".text-v2-button-s-strong"), true);

assert.equal(communityTokenDocument.font.family.base.$value, "Pretendard");
assert.equal(communityTokenDocument.typography.v2.h1.$value.fontSize, "38px");
assert.equal(communityTokenDocument.typography.v2.buttonM.$value.letterSpacing, "0.2px");

console.log("typography token handoff ok");
