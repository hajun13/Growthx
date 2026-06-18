import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tokens = JSON.parse(readFileSync(new URL("../design-tokens/form-controls.tokens.json", import.meta.url), "utf8"));
const css = readFileSync(new URL("../styles/form-controls.css", import.meta.url), "utf8");
const docs = readFileSync(new URL("../docs/form-controls.md", import.meta.url), "utf8");

assert.equal(tokens.formControl.source.$value.nodeId, "1:28187");
assert.equal(tokens.formControl.control.size.$value, "24px");
assert.equal(tokens.formControl.option.radius.$value, "8px");
assert.equal(tokens.formControl.color.selected.$value.accent, "#4C1E8B");
assert.equal(tokens.formControl.switch.width.$value, "60px");
assert.equal(tokens.formControl.switch.onBackground.$value, "#4DBFB8");

assert.match(css, /\.form-option__input\[type="checkbox"\]:indeterminate/);
assert.match(css, /\.form-option__input\[aria-invalid="true"\]/);
assert.match(css, /\.switch__input:checked \+ \.switch__track/);
assert.match(css, /role="switch"|switch__input/);

assert.match(docs, /Use native `<input type="checkbox">` and `<input type="radio">`/);
assert.match(docs, /aria-checked="mixed"/);
assert.match(docs, /state=normal\/checked\/half/);

console.log("form controls handoff ok");
