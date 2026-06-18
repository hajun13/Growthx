import assert from "node:assert/strict";
import test from "node:test";

import {
  getToastAction,
  getToastClasses,
  getToastDurationVars,
  getToastLine,
  getToastLiveRegionProps,
  getToastProps,
  getToastViewportProps,
  toastActions,
  toastLines,
  toastPlacements,
  toastStatuses,
  toastViewports,
} from "../src/toast.mjs";

test("toast API exposes Figma axes", () => {
  assert.deepEqual(toastStatuses, ["normal", "warn", "error", "pass"]);
  assert.deepEqual(toastLines, ["single", "double"]);
  assert.deepEqual(toastActions, ["none", "normal", "longer"]);
  assert.deepEqual(toastPlacements, ["top-center", "bottom-center"]);
  assert.deepEqual(toastViewports, ["desktop", "tablet", "mobile"]);
});

test("getToastClasses composes the default Figma toast", () => {
  assert.equal(
    getToastClasses(),
    "ds-toast ds-toast--normal ds-toast--single ds-toast--action-none ds-toast--top-center ds-toast--open",
  );
});

test("getToastClasses maps mobile viewport to bottom-center", () => {
  assert.equal(
    getToastClasses({ status: "pass", line: "double", action: "normal", viewport: "mobile", icon: true, close: true }),
    "ds-toast ds-toast--pass ds-toast--double ds-toast--action-normal ds-toast--bottom-center ds-toast--with-icon ds-toast--closable ds-toast--open",
  );
});

test("getToastProps wires duration and live region", () => {
  assert.deepEqual(getToastProps({ id: "toast-a", status: "error", message: "Failed\nTry again", action: "normal" }), {
    id: "toast-a",
    className: "ds-toast ds-toast--error ds-toast--double ds-toast--action-normal ds-toast--top-center ds-toast--open",
    "data-status": "error",
    "data-line": "double",
    "data-action": "normal",
    "data-duration": "2000",
    "data-open": "true",
    role: "alert",
    "aria-live": "assertive",
    "aria-atomic": "true",
  });
});

test("getToastViewportProps supports bottom bar offset", () => {
  assert.deepEqual(getToastViewportProps({ id: "toasts", viewport: "tablet", hasBottomBar: true }), {
    id: "toasts",
    className: "ds-toast-viewport ds-toast-viewport--bottom-center ds-toast-viewport--tablet ds-toast-viewport--with-bottom-bar",
  });
});

test("toast helpers infer line, action, duration, and live region", () => {
  assert.equal(getToastLine("one line"), "single");
  assert.equal(getToastLine("first\nsecond"), "double");
  assert.equal(getToastAction(null), "none");
  assert.equal(getToastAction("Action"), "normal");
  assert.equal(getToastAction("Long label"), "longer");
  assert.deepEqual(getToastDurationVars({ duration: 2500, fadeDuration: 150 }), {
    "--toast-duration": "2500ms",
    "--toast-fade-duration": "150ms",
  });
  assert.deepEqual(getToastLiveRegionProps({ status: "pass" }), {
    role: "status",
    "aria-live": "polite",
    "aria-atomic": "true",
  });
});

test("toast helpers reject unknown values", () => {
  assert.throws(() => getToastClasses({ status: "success" }), /status must be one of/);
  assert.throws(() => getToastClasses({ line: "triple" }), /line must be one of/);
  assert.throws(() => getToastClasses({ action: "primary" }), /action must be one of/);
  assert.throws(() => getToastClasses({ placement: "left" }), /placement must be one of/);
  assert.throws(() => getToastViewportProps({ viewport: "watch" }), /viewport must be one of/);
});
