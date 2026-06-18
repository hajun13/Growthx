import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getButtonClasses,
  getSelectAriaProps,
  getTooltipClasses,
  getSemanticColors,
  getTypographyStyle
} from "../src/index.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

assert.equal(typeof getButtonClasses, "function");
assert.equal(typeof getSelectAriaProps, "function");
assert.equal(typeof getTooltipClasses, "function");
assert.equal(getButtonClasses({ variant: "contained" }).includes("button"), true);
assert.equal(getSelectAriaProps({ open: true }).trigger["aria-expanded"], "true");
assert.equal(getTooltipClasses({ placement: "top-end" }).includes("tooltip--top-end"), true);
assert.equal(getSemanticColors("light").textPrimary.startsWith("#"), true);
assert.equal(getTypographyStyle("body1").fontSize.endsWith("px"), true);

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.equal(packageJson.exports["."].import, "./src/index.mjs");
assert.equal(packageJson.exports["."].types, "./src/index.d.ts");
assert.equal(packageJson.exports["./styles.css"], "./styles/index.css");

const manifest = JSON.parse(readFileSync(join(root, "design-tokens", "manifest.json"), "utf8"));
for (const tokenPath of Object.values(manifest.tokens)) {
  assert.equal(existsSync(join(root, "design-tokens", tokenPath)), true, `${tokenPath} exists`);
}

const css = readFileSync(join(root, "styles", "index.css"), "utf8");
for (const cssFile of [
  "color-tokens.css",
  "typography.css",
  "spacing.css",
  "layout.css",
  "button.css",
  "input.css",
  "select.css",
  "tooltip.css"
]) {
  assert.equal(css.includes(`@import "./${cssFile}";`), true, `${cssFile} imported`);
}

console.log("package surface handoff ok");
