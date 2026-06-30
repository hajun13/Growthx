# @energyx/ui

App-facing EnergyX shared UI package.

Use this package in EnergyX services when you need the common Notion Low Color visual language from the root `DESIGN.md`.

## Install

```json
{
  "dependencies": {
    "@energyx/ui": "workspace:*"
  }
}
```

## Tailwind

```js
module.exports = {
  presets: [require("@energyx/ui/tailwind-preset.cjs")],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
};
```

## CSS

Import once at the app root.

```ts
import "@energyx/ui/styles.css";
```

## Headless Helpers

```ts
import { getButtonClasses, getLabelClasses } from "@energyx/ui";
```

The lower-level token/helper implementation lives in `@energyx/v2-design-system`; application code should prefer `@energyx/ui`.
