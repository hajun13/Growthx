import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getTextFieldA11y,
  getTextFieldClasses,
  inputFigmaSource,
  inputSizes,
  inputStates,
  inputVariants,
} from "../src/input.mjs";

const tokenDocument = JSON.parse(readFileSync("design-tokens/input.tokens.json", "utf8"));

assert.equal(inputFigmaSource.nodeId, "1:22980");
assert.deepEqual(inputVariants, ["textfield", "select"]);
assert.deepEqual(inputStates, ["enabled", "focused", "error", "disabled"]);
assert.equal(inputSizes.desktop.height, 60);
assert.equal(inputSizes.mobile.height, 50);

assert.equal(tokenDocument.source.figmaNodeId, "1:22980");
assert.equal(tokenDocument.input.field.borderFocused.$value, "#7A37D8");
assert.equal(tokenDocument.input.field.borderError.$value, "#FF3F56");

assert.equal(
  getTextFieldClasses({ size: "mobile", invalid: true, prefix: "search", suffix: "clear", counter: true }),
  "text-field text-field--mobile text-field--textfield text-field--error text-field--with-prefix text-field--with-suffix text-field--with-counter",
);

assert.deepEqual(getTextFieldA11y({ id: "email", helperText: "Use work email" }), {
  "aria-invalid": undefined,
  "aria-describedby": "email-helper",
});

assert.deepEqual(getTextFieldA11y({ id: "email", errorText: "Required", describedBy: "external-hint" }), {
  "aria-invalid": "true",
  "aria-describedby": "external-hint email-error",
});

console.log("input handoff ok");
