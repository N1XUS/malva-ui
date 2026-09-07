# 2026-08 — Overlay chrome, initial focus, and viewport clamping

Three default behaviours changed across `@malva-ui/cdk/overlay`,
`@malva-ui/core/dialog`, `@malva-ui/core/drawer`, and
`@malva-ui/core/scrollbar`. Every public API addition is additive; what moved is
what happens when you do nothing.

---

## 1. Service-opened dialogs now render a close button by default

**Was:** `MlvDialogService.open()` rendered the content and nothing else — no
header, no close button, and an accessible name only if `config.ariaLabel` /
`config.ariaLabelledBy` was passed.

**Now:** `MlvDialogConfig` gains `title?: string` and
`showCloseButton?: boolean` (**default `true`**). Unless you opt out, every
service-opened dialog gets Malva's own `.mlv-dialog__header-row` with a close
button — the same row the declarative `<mlv-dialog>` has always rendered (both
paths now share the internal `MlvDialogHeaderRow`).

**Migration:**

| Situation                                            | Action                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Content already renders its own header **and** close | Pass `showCloseButton: false`.                                         |
| Content renders its own `[mlvDialogHeader]` heading  | Nothing required; move the text to `title` for the standard row.       |
| Dialog must not be dismissible except by its actions | Pass `showCloseButton: false` (see `confirm()` below for the pattern). |

**Accessible naming** now resolves in this order:
`ariaLabelledBy` → `title` (points at the rendered heading) → `ariaLabel` →
string content → a `[mlvDialogHeader]` the content rendered itself (resolved
after the first render). Previously only the first three existed.

---

## 2. `initialFocus` — overlays no longer capture the first tabbable node

**Was:** `<mlv-dialog>` and `<mlv-drawer>` used
`[cdkTrapFocusAutoCapture]="true"`, and `MlvOverlayServiceBase` used the focus
trap's initial-element capture. Both take the **first tabbable node**, which in
practice was the leftmost `mlv-button-close` in a drawer (its "Close" tooltip
popped on every open) or `.mlv-scrollbar__viewport` in a service dialog (a focus
ring around the entire body).

**Now:** `@malva-ui/cdk/overlay` exports `MlvOverlayInitialFocus` and
`MlvOverlayInitialFocusResolver`, and both hosts apply it:

- `<mlv-dialog>` / `<mlv-drawer>`: new `initialFocus` input, default `'auto'`.
- `MlvDialogService` / `MlvDrawerService`: new `MlvBaseOverlayConfig.initialFocus`,
  default `'auto'`.

| Value              | Meaning                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `'auto'` (default) | A projected `[mlvAutofocus]` element, else the first tabbable that is **not** the close button or the scroll viewport, else the modal surface. |
| `'container'`      | The modal surface itself (announced, nothing pre-selected).                                                                                    |
| `'first-tabbable'` | The old behaviour — first tabbable in DOM order, nothing skipped.                                                                              |
| `HTMLElement`      | That element.                                                                                                                                  |
| any other string   | A CSS selector resolved inside the overlay.                                                                                                    |

**Migration:** pass `initialFocus="first-tabbable"` (or the config field) to
restore the previous target. Focus **restore** on close is unchanged.

---

## 3. `mlv-scrollbar` viewport is a tab stop only when its content is not

> **Superseded** by
> [2026-08-scrollbar-viewport-tabindex.md](2026-08-scrollbar-viewport-tabindex.md).
> The auto mode described below is deleted: `viewportTabIndex` is now a pure
> passthrough of type `-1 | 0 | null`, defaulting to `null` (no attribute), and
> `0` means a literal, unconditional tab stop. The section is kept for the
> history of how the viewport reached its current shape.

**Was:** `.mlv-scrollbar__viewport` always carried `tabindex="0"`.

**Now:** the `viewportTabIndex` default of `0` means **auto** — the viewport is
a tab stop only while the scrolled content holds nothing tabbable. A text-only
region stays keyboard-scrollable (WCAG 2.1.1); a region full of controls no
longer inserts a redundant stop (and focus ring) in front of them. Any non-zero
`viewportTabIndex` is still applied verbatim.

**Migration:** none for the common cases. If you relied on the viewport being
focusable while it also contains controls, give it an explicit non-zero
tabindex — there is deliberately no way to force `0`, because that is the auto
value.

---

## 4. Drawer panels are clamped to the viewport

**Was:** `size` was written straight to the panel and `minSize`/`maxSize` were
consulted only when `resizable` was true, so `size="36rem"` rendered 576 px wide
on a 375 px phone and hung off the edge.

**Now:** both the declarative and service paths emit `max-width`/`max-height`,
folding `maxSize` into a `100dvw`/`100dvh` ceiling via CSS `min()` — regardless
of `resizable`. `MlvDrawerConfig` gains the matching `maxSize?: string`.

**Migration:** none, unless you depended on a drawer overflowing the viewport.

---

## 5. New: `MlvDialogService.confirm()`

```ts
const confirmed$ = dialogService.confirm({
  title: 'Delete project?',
  message: 'The project and all of its tasks are removed.',
  confirmLabel: 'Delete project',
  destructive: true,
});
```

Returns an `Observable<boolean>` that emits **once** and completes, so it drops
into a `CanDeactivateFn` unchanged. Escape, the backdrop, and `ref.close()` all
resolve `false`. `destructive: true` (or `tone: 'danger'`) turns the confirm
button danger-coloured and moves initial focus to **Cancel**. Labels default to
the dialog i18n pack (`confirm` / `cancel`, new keys in all fourteen locales).

`MlvConfirmDialogOptions` is exported from `@malva-ui/core/dialog`.
