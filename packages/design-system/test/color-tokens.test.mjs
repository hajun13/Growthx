import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  colorPrimitives,
  getSemanticColors,
  semanticColorModes,
  toCssVariableMap,
} from "../src/color-tokens.mjs";

const tokenDocument = JSON.parse(readFileSync("tokens/color-board-01.json", "utf8"));
const communityTokenDocument = JSON.parse(readFileSync("design-tokens/color.tokens.json", "utf8"));

assert.equal(colorPrimitives.primary[60], "#0075DE");
assert.equal(colorPrimitives.secondary["05"], "#F9FAFA");
assert.equal(colorPrimitives.blue[10], "#F9FCFF");

assert.equal(getSemanticColors("light").surfaceCanvas, "#F6F5F4");
assert.equal(getSemanticColors("dark").accentPrimary, "#3398EA");
assert.equal(getSemanticColors("highContrast").accentWarm, "#B45309");
assert.throws(() => getSemanticColors("sepia"), /Unknown color mode/);

assert.deepEqual(Object.keys(semanticColorModes), ["light", "dark", "highContrast"]);
assert.equal(toCssVariableMap("dark")["--color-text-primary"], "#FFFFFF");

assert.equal(tokenDocument.source.figmaNodeId, "1:16027");
assert.equal(communityTokenDocument.color.primary[60].$value, "#0075DE");
assert.equal(communityTokenDocument.semanticColor.accentPrimary.$extensions.cssVariable, "--color-accent-primary");

console.log("color token handoff ok");
