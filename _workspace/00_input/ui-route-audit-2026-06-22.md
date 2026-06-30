# GrowthX UI Route Audit - 2026-06-22

## Goal

Unify the full product interface so every route reads as one EnergyX HR evaluation system. The issue is not isolated component drift; it is inconsistent page grammar across workflow, management, report, and support screens.

## Route Inventory

Build output contains 36 routes including generated assets and dynamic routes. The product UI audit targets these rendered page groups:

| Group | Routes | Current mismatch to correct |
| --- | --- | --- |
| Workflow | `/kpi`, `/kpi/review`, `/eval/my`, `/eval/self`, `/eval/dept-head`, `/eval/midterm`, `/competency/eval`, `/appeals` | Mixed single-column, accordion list, master-detail, and tab layouts with inconsistent context placement and card rhythm. |
| Management | `/admin/users`, `/admin/permissions`, `/admin/audit`, `/admin/competency/items`, `/admin/cycle`, `/admin/rules`, `/admin/settings`, `/admin/group-performance`, `/admin/monthly-performance`, `/admin/kpi-import`, `/admin/compensation-import`, `/admin/compensation` | Tables, filters, summary metrics, and helper panels are composed differently per page. |
| Reports | `/eval/result`, `/eval/result/[userId]`, `/reports`, `/reports/evaluation-summary`, `/reports/yoy` | Report pages mix dashboard cards, tables, and chart canvases without one report hierarchy. |
| Support | `/dashboard`, `/notifications`, `/org`, `/login`, `/onboarding/password`, `/`, `/eval`, `/admin/midterm/rebaseline` | Support pages should keep their function but inherit the same surface, spacing, and action grammar. |

## Implementation Priority

1. Shared page grammar and CSS primitives.
2. Workflow screens, because the KPI and midterm screenshots show the clearest cross-page mismatch.
3. Management screens, because they share data-table behavior but currently use different filter and metric structures.
4. Report screens, because chart and summary pages need one analysis canvas pattern.
5. Support screens and redirect/empty states.

## Acceptance Notes

- Do not solve this by moving metrics into identical top panels everywhere.
- Keep domain-specific content, but place it into shared page grammar.
- Keep API, DB, and scoring behavior unchanged.
