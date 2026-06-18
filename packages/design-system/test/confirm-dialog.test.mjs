import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmDialogActionLayouts,
  confirmDialogIntents,
  getConfirmDialogA11yProps,
  getConfirmDialogActionProps,
  getConfirmDialogClasses,
  getConfirmDialogOverlayClasses,
  trapConfirmDialogFocus,
} from "../src/confirm-dialog.mjs";

test("confirm dialog API exposes semantic axes", () => {
  assert.deepEqual(confirmDialogIntents, ["default", "danger"]);
  assert.deepEqual(confirmDialogActionLayouts, ["horizontal", "stacked"]);
});

test("getConfirmDialogClasses composes default open dialog classes", () => {
  assert.equal(
    getConfirmDialogClasses(),
    "confirm-dialog confirm-dialog--default confirm-dialog--actions-horizontal confirm-dialog--open",
  );
});

test("getConfirmDialogClasses supports danger and stacked actions", () => {
  assert.equal(
    getConfirmDialogClasses({ intent: "danger", actionLayout: "stacked", className: "extra" }),
    "confirm-dialog confirm-dialog--danger confirm-dialog--actions-stacked confirm-dialog--open extra",
  );
});

test("getConfirmDialogOverlayClasses reflects open state", () => {
  assert.equal(
    getConfirmDialogOverlayClasses({ open: false, className: "portal" }),
    "confirm-dialog__overlay portal",
  );
});

test("getConfirmDialogA11yProps wires modal labelling", () => {
  assert.deepEqual(getConfirmDialogA11yProps({ id: "remove-card" }), {
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "remove-card-title",
    "aria-describedby": "remove-card-description",
    tabIndex: -1,
  });
});

test("getConfirmDialogA11yProps can omit aria-describedby", () => {
  assert.deepEqual(getConfirmDialogA11yProps({ id: "notice", describedBy: false }), {
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "notice-title",
    tabIndex: -1,
  });
});

test("getConfirmDialogActionProps maps danger confirm action", () => {
  assert.deepEqual(getConfirmDialogActionProps({ intent: "danger", cancelLabel: "No", confirmLabel: "Delete" }), {
    cancel: {
      className: "confirm-dialog__action confirm-dialog__action--cancel",
      type: "button",
      children: "No",
    },
    confirm: {
      className:
        "confirm-dialog__action confirm-dialog__action--confirm confirm-dialog__action--danger",
      type: "button",
      children: "Delete",
    },
  });
});

test("helpers reject unknown semantic values", () => {
  assert.throws(() => getConfirmDialogClasses({ intent: "warning" }), /intent must be one of/);
  assert.throws(
    () => getConfirmDialogClasses({ actionLayout: "grid" }),
    /actionLayout must be one of/,
  );
});

test("trapConfirmDialogFocus ignores non-tab keys", () => {
  const event = { key: "Escape", shiftKey: false, preventDefault() {} };
  assert.equal(trapConfirmDialogFocus(event, null), false);
});
