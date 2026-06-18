import assert from "node:assert/strict";
import test from "node:test";

import {
  getHashtagChipAriaProps,
  getHashtagChipClasses,
  getHashtagLabelClasses,
  getLabelClasses,
  getValueChipClasses,
  hashtagChipKinds,
  hashtagLabelTones,
  labelTones,
  labelVariants,
} from "../src/chip.mjs";

test("chip API exposes semantic axes instead of raw Figma states", () => {
  assert.deepEqual(labelTones, ["primary", "darkgray", "secondary", "red", "lightgray"]);
  assert.deepEqual(labelVariants, ["fill", "border"]);
  assert.deepEqual(hashtagChipKinds, ["toggle", "user"]);
  assert.deepEqual(hashtagLabelTones, ["default", "partner"]);
});

test("getLabelClasses composes label variant and tone", () => {
  assert.equal(
    getLabelClasses({ variant: "border", tone: "red" }),
    "ds-label ds-label--border ds-label--red",
  );
});

test("getHashtagChipClasses maps toggle enable and pressed states", () => {
  assert.equal(
    getHashtagChipClasses(),
    "ds-hashtag-chip ds-hashtag-chip--with-leading-icon",
  );
  assert.equal(
    getHashtagChipClasses({ selected: true }),
    "ds-hashtag-chip ds-hashtag-chip--selected ds-hashtag-chip--with-leading-icon",
  );
});

test("getHashtagChipClasses maps user-made default and after states", () => {
  assert.equal(
    getHashtagChipClasses({ kind: "user" }),
    "ds-hashtag-chip ds-hashtag-chip--user ds-hashtag-chip--removable",
  );
  assert.equal(
    getHashtagChipClasses({ kind: "user", after: true }),
    "ds-hashtag-chip ds-hashtag-chip--user ds-hashtag-chip--after",
  );
});

test("getHashtagChipAriaProps uses pressed state for toggle chips", () => {
  assert.deepEqual(getHashtagChipAriaProps({ selected: true }), { "aria-pressed": "true" });
});

test("getHashtagLabelClasses supports partner tone", () => {
  assert.equal(
    getHashtagLabelClasses({ tone: "partner" }),
    "ds-hashtag-label ds-hashtag-label--partner",
  );
});

test("getValueChipClasses allows extension classes", () => {
  assert.equal(getValueChipClasses({ className: "custom" }), "ds-value-chip custom");
});

test("chip helpers reject unknown values", () => {
  assert.throws(() => getLabelClasses({ tone: "warning" }), /tone must be one of/);
  assert.throws(() => getHashtagChipClasses({ kind: "pressed" }), /kind must be one of/);
});
