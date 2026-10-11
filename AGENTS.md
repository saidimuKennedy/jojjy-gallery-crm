# Jojjy Gallery CRM — agent & contributor guide

## UI system (required)

All CRM UI **must** compose the shared primitives in `components/ui`
(`Button`, `Field`, `TextField`, `Select`, `TextArea`, `DateTimeField`,
`CurrencyField`, `Card`, `StatCard`, `Chip`, `PageHeader`, `PageShell`,
`SectionHeading`, `Table`/`Th`/`Td`, `StatusBadge`, `Alert`, `Modal`,
`ConfirmDialog`, `WizardSteps`, `Toolbar`, `FormActions`, `EmptyState`,
`LoadingState`, `ErrorState`, `LinkButton`).

**Reference surface:** the event-creation wizard
(`components/events/EventWizard.tsx`) and `pages/dashboard/events.tsx` — copy
their patterns.

### Do
- Use the shared components and the semantic tokens: `accent-*` (primary
  action), `surface`, `border`, `muted`, `rounded-card`, `rounded-field`,
  `shadow-card`.
- Use `Table` for tabular data; `Field` + inputs for forms; `StatusBadge`/`Chip`
  for state; `Modal`/`ConfirmDialog` for dialogs; the shared empty/loading/error
  states for every data view.
- Keep primary actions in the single accent (blue) family.

### Don't
- Don't add raw color palettes (`gray-*`, hex literals) or `bg-ink-950` buttons.
- Don't hand-roll `<table>` markup in pages — use `Table`.
- Don't introduce one-off radii (`rounded-md`/`rounded-lg`/`rounded-sm`); use
  `rounded-card`/`rounded-field`/`rounded-full`.
- Don't create module-specific button/badge/modal/wizard styles.

## Verification
- `npm run typecheck` (tsc) must pass.
- `npm run lint` (wired in the guardrails phase) must pass and enforces the rules above.

## Notes
- Fonts: Inter, loaded in `pages/_document.tsx` with a system fallback.
- OpenUI actions are allowlisted in `components/openui/library.ts` and
  permission-guarded in `pages/api/openui/action.ts`; the model never touches
  the database directly and every write goes through a reviewed workflow.
