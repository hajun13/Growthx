import assert from "node:assert/strict";
import {
  getNextEnabledOptionIndex,
  getOptionAriaProps,
  getSelectAriaProps,
  getSelectClassNames,
  normalizeSelectProps,
  reduceSelectKeyboardState,
} from "../src/select.mjs";

const options = [
  { id: "option-a", value: "a" },
  { id: "option-b", value: "b", disabled: true },
  { id: "option-c", value: "c" },
];

assert.deepEqual(normalizeSelectProps(), {
  size: "md",
  open: false,
  disabled: false,
  invalid: false,
  multiple: false,
  placeholder: "Select an option",
});
assert.throws(() => normalizeSelectProps({ size: "xl" }), /Unknown select size/);

assert.equal(
  getSelectClassNames({ size: "lg", open: true, invalid: true }),
  "select select--lg select--open select--invalid",
);
assert.equal(
  getSelectClassNames({ open: true, disabled: true }),
  "select select--md select--disabled",
);

assert.deepEqual(getSelectAriaProps({
  open: true,
  invalid: true,
  multiple: true,
  listboxId: "select-list",
  activeOptionId: "option-c",
}), {
  trigger: {
    "aria-controls": "select-list",
    "aria-disabled": undefined,
    "aria-expanded": "true",
    "aria-haspopup": "listbox",
    "aria-invalid": "true",
    "aria-activedescendant": "option-c",
    role: "combobox",
    tabIndex: 0,
  },
  listbox: {
    id: "select-list",
    role: "listbox",
    "aria-multiselectable": "true",
  },
});

assert.deepEqual(getOptionAriaProps(options[2], {
  value: "c",
  highlightedValue: "c",
}), {
  id: "option-c",
  role: "option",
  "aria-disabled": undefined,
  "aria-selected": "true",
  "data-highlighted": "true",
});

assert.equal(getNextEnabledOptionIndex(options, 0, "next"), 2);
assert.equal(getNextEnabledOptionIndex(options, 0, "previous"), 2);

let state = reduceSelectKeyboardState({ open: false }, "ArrowDown", options);
assert.deepEqual(state, { open: true, highlightedValue: "a" });

state = reduceSelectKeyboardState(state, "ArrowDown", options);
assert.deepEqual(state, { open: true, highlightedValue: "c" });

state = reduceSelectKeyboardState(state, "Enter", options);
assert.deepEqual(state, { open: false, highlightedValue: "c", value: "c" });

state = reduceSelectKeyboardState({ open: true, highlightedValue: "c" }, "Escape", options);
assert.deepEqual(state, { open: false, highlightedValue: "c" });

console.log("select handoff ok");
