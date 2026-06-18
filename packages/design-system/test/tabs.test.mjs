import assert from "node:assert/strict";
import {
  getNextEnabledTabIndex,
  getTabPanelProps,
  getTabProps,
  getTabsRootProps,
  normalizeTabsProps,
  reduceTabsKeyboardState,
} from "../src/tabs.mjs";

const items = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings", disabled: true },
  { id: "history", label: "History", badge: true },
];

assert.deepEqual(normalizeTabsProps({ items }), {
  variant: "underline",
  size: "s",
  orientation: "horizontal",
  value: "overview",
  items,
  activation: "automatic",
});
assert.throws(() => normalizeTabsProps({ variant: "ghost" }), /Unknown tabs variant/);
assert.throws(() => normalizeTabsProps({ size: "m" }), /Unknown tabs size/);

assert.deepEqual(getTabsRootProps({
  variant: "box-border",
  size: "l",
  orientation: "vertical",
  items,
}), {
  className: "tabs tabs--box-border tabs--l tabs--vertical",
  "data-type": "box-border",
  "data-size": "l",
  "data-orientation": "vertical",
  role: "tablist",
  "aria-orientation": "vertical",
});

assert.deepEqual(getTabProps(items[2], { value: "history", items }), {
  id: "tab-history",
  className: "tabs__tab",
  role: "tab",
  type: "button",
  disabled: false,
  "aria-selected": "true",
  "aria-controls": "panel-history",
  "aria-disabled": undefined,
  tabIndex: 0,
  "data-state": "pressed",
  "data-badge": "on",
});

assert.deepEqual(getTabProps(items[1], { value: "overview", items }), {
  id: "tab-settings",
  className: "tabs__tab",
  role: "tab",
  type: "button",
  disabled: true,
  "aria-selected": "false",
  "aria-controls": "panel-settings",
  "aria-disabled": "true",
  tabIndex: -1,
  "data-state": "enable",
  "data-badge": "off",
});

assert.deepEqual(getTabPanelProps(items[0], { value: "history", items }), {
  id: "panel-overview",
  className: "tabs__panel",
  role: "tabpanel",
  "aria-labelledby": "tab-overview",
  hidden: true,
  tabIndex: 0,
});

assert.equal(getNextEnabledTabIndex(items, 0, "next"), 2);
assert.equal(getNextEnabledTabIndex(items, 0, "previous"), 2);

let state = reduceTabsKeyboardState(
  { value: "overview", focusedValue: "overview" },
  "ArrowRight",
  items,
);
assert.deepEqual(state, { value: "history", focusedValue: "history" });

state = reduceTabsKeyboardState(state, "Home", items, { activation: "manual" });
assert.deepEqual(state, { value: "history", focusedValue: "overview" });

state = reduceTabsKeyboardState(state, "Enter", items, { activation: "manual" });
assert.deepEqual(state, { value: "overview", focusedValue: "overview" });

state = reduceTabsKeyboardState(
  { value: "overview", focusedValue: "overview" },
  "ArrowDown",
  items,
  { orientation: "vertical" },
);
assert.deepEqual(state, { value: "history", focusedValue: "history" });

console.log("tabs handoff ok");
