# Notion Low Color Design System

Figma guide boards 01-16 converted into production-facing design-system assets:

- Design tokens in `design-tokens/*.tokens.json`
- CSS variables and component contracts in `styles/*.css`
- Headless JavaScript helpers and TypeScript declarations in `src/`
- Board-level handoff notes in `docs/`

## Install In A Project

Use this folder as a local package or copy the folders into your app package.

```json
{
  "dependencies": {
    "@energyx/v2-design-system": "file:../Design"
  }
}
```

## CSS

Import the full CSS contract once near the app root:

```js
import "@energyx/v2-design-system/styles.css";
```

Or import only the pieces you need:

```js
import "@energyx/v2-design-system/styles/button.css";
import "@energyx/v2-design-system/styles/input.css";
```

## JavaScript API

The package exports headless helpers for class composition, ARIA props, keyboard reducers, and token lookup.

```js
import {
  getButtonClasses,
  getTextFieldClasses,
  getSelectAriaProps,
  getTooltipTriggerProps,
  getSemanticColors
} from "@energyx/v2-design-system";

const buttonClassName = getButtonClasses({
  variant: "contained",
  size: "md",
  service: "default"
});
```

## Tokens

Token files are available through the package exports:

```js
import tokenManifest from "@energyx/v2-design-system/tokens" assert { type: "json" };
```

For design-token pipelines, read the files under `design-tokens/` directly.

## Verification

```sh
npm test
```

The test suite validates the public helpers and token handoff contracts.

