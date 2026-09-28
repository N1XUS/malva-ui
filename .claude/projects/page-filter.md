---

# Docs page: Filter

Path: `apps/docs/src/app/pages/filter`

The page documents `@malva-ui/core/filter` through four examples:

1. bounded single/multiple option filters plus their loading state;
2. explicit-apply free-text conditions with an AND/OR strategy (OR is the component default);
3. the metadata-driven Smart Filter Bar, required-field validation, active-field visibility guarantees, and its execution payload (plain data deeply copied, class-instance operands passed by reference — #351).
4. query appearance for realistic renewal triage: natural-language chips, the built-in Add filter flow, explicit and live apply modes, the grouped expression paired with the compatible flat payload, and a keyed `mlvFilterValueEditor` template that swaps the Renewal date field's built-in text input for `mlv-day-picker` (a paired day-picker for the `between` operator), round-tripping the same ISO `yyyy-MM-dd` condition value.

Examples import only the public secondary entry point and keep query state observable in the preview. Payload JSON is deliberately outside the live region so assistive technology announces the concise query status rather than the entire serialized payload. When the component contract changes, update the examples and this page note together.
