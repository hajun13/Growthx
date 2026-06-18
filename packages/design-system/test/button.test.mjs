import assert from "node:assert/strict";
import test from "node:test";

import {
  buttonServices,
  buttonSizes,
  buttonVariants,
  getButtonAriaProps,
  getButtonClasses,
} from "../src/button.mjs";

test("button API exposes semantic axes instead of Figma variant names", () => {
  assert.deepEqual(buttonVariants, ["contained", "outlined", "text"]);
  assert.deepEqual(buttonSizes, ["sm", "md", "lg"]);
  assert.deepEqual(buttonServices, ["default", "kakao", "naver", "google", "apple"]);
});

test("getButtonClasses composes default variant and size", () => {
  assert.equal(getButtonClasses(), "button button--md button--contained");
});

test("getButtonClasses maps service axis to branded visual class", () => {
  assert.equal(
    getButtonClasses({ service: "kakao", variant: "outlined", size: "lg" }),
    "button button--lg button--service-kakao",
  );
});

test("getButtonClasses supports icon-only buttons", () => {
  assert.equal(
    getButtonClasses({ leftIcon: true, children: false, size: "sm" }),
    "button button--sm button--contained button--icon-only",
  );
});

test("getButtonAriaProps uses native disabled for buttons", () => {
  assert.deepEqual(getButtonAriaProps({ disabled: true }), { disabled: true });
});

test("getButtonAriaProps uses aria-disabled for non-button elements", () => {
  assert.deepEqual(getButtonAriaProps({ disabled: true, as: "a" }), {
    "aria-disabled": "true",
    tabIndex: -1,
  });
});

test("getButtonClasses rejects unknown values", () => {
  assert.throws(() => getButtonClasses({ variant: "left_icon" }), /variant must be one of/);
});
