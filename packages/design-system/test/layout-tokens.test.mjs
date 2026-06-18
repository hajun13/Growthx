import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getLayoutBreakpoint,
  getLayoutGrid,
  layoutBreakpoints,
  layoutGrid,
  toLayoutCssVariableMap,
} from "../src/layout-tokens.mjs";

const tokenDocument = JSON.parse(readFileSync("design-tokens/layout.tokens.json", "utf8"));

assert.deepEqual(Object.keys(layoutBreakpoints), ["mobile", "tablet", "desktop"]);
assert.equal(getLayoutBreakpoint(360), "mobile");
assert.equal(getLayoutBreakpoint(767), "mobile");
assert.equal(getLayoutBreakpoint(768), "tablet");
assert.equal(getLayoutBreakpoint(1199), "tablet");
assert.equal(getLayoutBreakpoint(1200), "desktop");

assert.equal(getLayoutGrid(390).columns, 6);
assert.equal(getLayoutGrid(1024).offset, 24);
assert.equal(layoutGrid.desktop.columns, 12);
assert.equal(layoutGrid.desktop.containerMax, 1440);

assert.equal(toLayoutCssVariableMap("mobile")["--ds-layout-gutter"], "8px");
assert.equal(toLayoutCssVariableMap("tablet")["--ds-layout-columns"], "8");
assert.equal(toLayoutCssVariableMap("desktop")["--ds-layout-container-max"], "1440px");
assert.throws(() => toLayoutCssVariableMap("wide"), /Unknown layout breakpoint/);

assert.equal(tokenDocument.source.figmaNodeId, "1:16735");
assert.equal(tokenDocument.layoutGrid.mobile.columns.$value, 6);
assert.equal(tokenDocument.layoutGrid.tablet.containerMax.$value, "1439px");
assert.equal(tokenDocument.layoutGrid.desktop.containerMin.$value, "1440px");

console.log("layout token handoff ok");

