# Product UI Grammar - EnergyX HR Evaluation

## Product Rhythm

Every route should follow this visible order:

1. Page title and scope controls.
2. Compact context or status line when needed.
3. Primary work surface.
4. Supporting detail, history, or secondary panels.
5. Sticky or footer action area only when the workflow needs persistent submission.

## Archetypes

### Workflow

Used by KPI, evaluation, review, midterm, competency, and appeal pages.

- Main work area uses bordered white surfaces with no decorative nesting.
- Target selection, task list, and detail panel use a consistent master-detail rhythm.
- Tabs sit directly above the work surface, not floating between unrelated cards.
- Status and weight badges stay compact and aligned to the relevant item.

### Management

Used by admin and operations pages.

- Filter/search controls live in a single toolbar.
- Summary numbers are compact and contextual, not dashboard-like unless the page is a dashboard.
- Tables use one row density, header treatment, and empty state.
- Secondary guidance appears as a flat helper section, not another large card stack.

### Reports

Used by result and report pages.

- Summary metrics come before charts or tables.
- Charts and tables share the same canvas width and section header style.
- Drilldown details should appear as secondary panels, not unrelated cards.

### Support

Used by dashboard, notifications, org, login, onboarding, redirects, and empty states.

- Keep the task simple, but inherit the same surface, radius, border, and spacing tokens.
- Avoid marketing composition or standalone decorative cards.

## Shared Rules

- `PageContainer` is the only top-level page rhythm.
- `PageHeader` is title/scope/action only; body structure belongs below it.
- `Card`, `DataTable`, `Tabs`, `SegmentedControl`, `FilterChipBar`, and `EvaluationSubjectPanel` must share the same border, radius, and spacing language.
- Avoid nested cards. Use flat sections inside a surface when content is subordinate.
- Prefer dense, readable enterprise layout over large decorative spacing.
