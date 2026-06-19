# UIUX Page Rollout Plan

Date: 2026-06-19
Mode: speed-first rollout

## Common Patterns

### 1. Work Execution

Use for KPI, self evaluation, dept-head evaluation, midterm.

- Header: page title, current cycle, primary action.
- Summary: progress, deadline, completion state, missing work.
- Work list: grouped by KPI group, evaluator stage, or action status.
- Detail: only one dense work surface at a time.
- Sticky actions: solid background, 8px controls, no blur/glass.

### 2. Data Operations

Use for admin users, permissions, rules, cycle, audit, imports.

- Header: page title and one primary action.
- FilterBar: search, filters, reset, count.
- DataTable: title, toolbar, loading rows, empty state, row actions.
- Detail drawer/modal: edit and destructive flows.
- Avoid summary cards unless they change the user's next action.

### 3. Reports And Results

Use for reports, YoY, results, org distributions.

- Header: scope and export action.
- Summary band: 3-4 metrics max.
- Exception section: what changed, what needs attention.
- Chart/table area: one visual question per section.
- Detail table: only after the summary and exception.

### 4. Review And Approval

Use for appeals, rebaseline review, dept-head evaluation, cycle ops.

- Header: queue count and primary action.
- Queue: status, owner, deadline, next action.
- Review detail: evidence, delta, decision controls.
- Confirmation: destructive or final actions require dialog.

### 5. Read-Only Reference

Use for notifications, org visibility, competency history.

- Header: purpose and filters.
- Grouped list or matrix.
- Plain language empty state.
- Minimize decorative chips.

## Route Targets

| Route group | Pattern | Target shape |
| --- | --- | --- |
| `/dashboard` | Reports And Results | current cycle summary, next work, schedule, recent changes |
| `/kpi` | Work Execution | KPI progress, draft list, criteria, bottom save/submit |
| `/kpi/review` | Review And Approval | review queue, selected item detail, approval CTA |
| `/eval/self` | Work Execution | completion summary, grouped KPI cards, bottom save/submit |
| `/eval/dept-head` | Review And Approval | evaluatee queue, stage context, scoring detail |
| `/eval/midterm` | Work Execution | routine stepper, action items, rebaseline status |
| `/eval/my` | Read-Only Reference | personal result summary, score breakdown, next explanation |
| `/eval/result` | Reports And Results | distribution summary, filters, result table |
| `/eval/result/[userId]` | Reports And Results | person detail, score comparison, evidence |
| `/reports` | Reports And Results | org summary, trends, export |
| `/reports/yoy` | Reports And Results | year comparison, org distribution, rule changes |
| `/reports/evaluation-summary` | Reports And Results | executive-ready summary |
| `/org` | Read-Only Reference | org structure, visibility matrix, people list |
| `/notifications` | Read-Only Reference | unread first, read grouped by date |
| `/appeals` | Review And Approval | appeal queue, evidence, answer state |
| `/competency/eval` | Work Execution | yearly competency questions, progress, submit |
| `/admin/*` | Data Operations | dense filters, table, edit modal, import/export |

## Non-AI Visual Checklist

- No glass, aurora, gradient mesh, glow shadow, or decorative blobs.
- No `rounded-full` except unavoidable third-party primitives; prefer 8px.
- No repeated large icon circles; use 8px icon tiles or no icon.
- No card inside card; use dividers, rows, tables, or flat sections.
- No vague "smart insight" copy; state concrete work, risk, or status.
- Purple only means primary action, selected state, or active progress.
- One primary CTA per screen section.
- Every empty state tells the user whether to wait, add data, or change filters.

## Implementation Order

1. Shared primitives and dashboard.
2. Work execution pages.
3. Data operation pages.
4. Reports/results.
5. Review/approval queues.
6. Visual QA and route sweep.
