import assert from "node:assert/strict";
import test from "node:test";

import {
  getTooltipBubbleProps,
  getTooltipClasses,
  getTooltipDelayVars,
  getTooltipRootProps,
  getTooltipTriggerProps,
  tooltipPlacements,
  tooltipTones,
} from "../src/tooltip.mjs";

test("tooltip API exposes Figma placement and tone axes", () => {
  assert.deepEqual(tooltipPlacements, ["bottom-start", "bottom-end", "top-start", "top-end"]);
  assert.deepEqual(tooltipTones, ["dark", "light"]);
});

test("getTooltipClasses composes the default Figma tooltip", () => {
  assert.equal(getTooltipClasses(), "ds-tooltip ds-tooltip--bottom-start ds-tooltip--dark");
});

test("getTooltipClasses supports optional arrow and controlled state", () => {
  assert.equal(
    getTooltipClasses({ placement: "top-end", tone: "light", arrow: true, open: true }),
    "ds-tooltip ds-tooltip--top-end ds-tooltip--light ds-tooltip--with-arrow ds-tooltip--open",
  );
});

test("getTooltipRootProps wires controlled open state", () => {
  assert.deepEqual(getTooltipRootProps({ id: "tip-a", open: true }), {
    className: "ds-tooltip ds-tooltip--bottom-start ds-tooltip--dark ds-tooltip--open",
    "data-open": "true",
    "data-tooltip-id": "tip-a",
  });
});

test("tooltip aria helpers support non-interactive content", () => {
  assert.deepEqual(getTooltipTriggerProps({ id: "tip-a" }), {
    "aria-describedby": "tip-a",
    type: "button",
  });
  assert.deepEqual(getTooltipBubbleProps({ id: "tip-a" }), {
    id: "tip-a",
    role: "tooltip",
  });
});

test("tooltip helpers support interactive layers separately", () => {
  assert.deepEqual(getTooltipTriggerProps({ id: "tip-b", interactive: true, open: true }), {
    "aria-describedby": "tip-b",
    "aria-expanded": true,
    "aria-haspopup": "dialog",
    type: "button",
  });
  assert.deepEqual(getTooltipBubbleProps({ id: "tip-b", interactive: true }), {
    id: "tip-b",
    role: "dialog",
  });
});

test("getTooltipDelayVars serializes delay values", () => {
  assert.deepEqual(getTooltipDelayVars({ showDelay: 200, hideDelay: 75 }), {
    "--tooltip-show-delay": "200ms",
    "--tooltip-hide-delay": "75ms",
  });
});

test("getTooltipClasses rejects unknown values", () => {
  assert.throws(() => getTooltipClasses({ placement: "left" }), /placement must be one of/);
  assert.throws(() => getTooltipClasses({ tone: "auto" }), /tone must be one of/);
});
