import assert from "node:assert/strict";
import test from "node:test";

import {
  formFieldButtonLayouts,
  formFieldMessageTones,
  getFormFieldA11yProps,
  getFormFieldClasses,
  getFormFieldMessageTone,
  getFormGroupClasses,
} from "../src/form-field.mjs";

test("form field API exposes semantic message and button axes", () => {
  assert.deepEqual(formFieldMessageTones, ["none", "helper", "error"]);
  assert.deepEqual(formFieldButtonLayouts, ["none", "single", "double"]);
});

test("getFormFieldClasses composes default field class", () => {
  assert.equal(getFormFieldClasses(), "form-field");
});

test("error message wins over helper text", () => {
  assert.equal(
    getFormFieldClasses({ helperText: "Helpful", errorMessage: "Required" }),
    "form-field form-field--invalid form-field--message-error",
  );
  assert.equal(getFormFieldMessageTone({ helperText: "Helpful", errorMessage: "Required" }), "error");
});

test("getFormFieldClasses maps unit and button placement", () => {
  assert.equal(
    getFormFieldClasses({ hasUnit: true, buttonLayout: "double", helperText: "Caption" }),
    "form-field form-field--with-unit form-field--button-double form-field--message-helper",
  );
});

test("getFormFieldA11yProps describes only the active status message", () => {
  assert.deepEqual(
    getFormFieldA11yProps({
      id: "energy",
      required: true,
      helperId: "energy-help",
      errorId: "energy-error",
      helperText: "kWh",
      errorMessage: "Enter a number",
    }),
    {
      id: "energy",
      "aria-required": "true",
      "aria-invalid": "true",
      "aria-describedby": "energy-error",
    },
  );
});

test("getFormGroupClasses supports horizontal multi-column groups", () => {
  assert.equal(
    getFormGroupClasses({ direction: "horizontal", columns: 2 }),
    "form-group form-group--horizontal form-group--cols-2",
  );
});

test("form helpers reject unknown values", () => {
  assert.throws(() => getFormFieldClasses({ buttonLayout: "triple" }), /buttonLayout must be one of/);
  assert.throws(() => getFormGroupClasses({ columns: 0 }), /columns must be a positive integer/);
});
