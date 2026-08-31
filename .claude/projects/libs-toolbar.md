---
# Library: toolbar

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Toolbar library (`@malva-ui/core/toolbar`) provides simple, composable components for building horizontal toolbars and action bars. Minimal layout-focused components for application headers and control panels.

## Public API

Exported from `libs/core/toolbar/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvToolbar` | Component | Horizontal container — `mlv-toolbar` |
| `MlvToolbarSpacer` | Component | Flex spacer — `mlv-toolbar-spacer` |
| `MlvToolbarRoving<V>` | Directive | **Opt-in** roving-focus container — `mlv-toolbar[mlvToolbarRoving]` |
| `MlvToolbarWidget<V>` | Directive | **Opt-in** toolbar widget marker — `[mlvToolbarWidget]` |

---

## Keyboard roving focus (opt-in · `@angular/aria` · Task 2.4)

> **Behavioral note (added capability):** by default `mlv-toolbar` is a pure layout container — every child is its own Tab stop, exactly as before. Adding `mlvToolbarRoving` to the toolbar and `mlvToolbarWidget` to each interactive child turns the toolbar into a **single Tab stop** whose widgets are traversed with the arrow keys / `Home` / `End`, following the WAI-ARIA toolbar pattern. This is a **new capability**, applied only when opted in — existing toolbars are unaffected.

**Why opt-in, not automatic:** `mlv-toolbar` projects arbitrary content, so aria widgets cannot be auto-attached to consumer children. Empirically, applying aria `ngToolbar` to a _widget-less_ container renders `role="toolbar"` + `tabindex="0"` + `aria-disabled="true"` on it (aria treats "no focusable items" as a disabled list) — a regression for every existing plain-button toolbar. The two opt-in markers avoid both problems.

### `MlvToolbarRoving` — `mlv-toolbar[mlvToolbarRoving]`

**File:** `libs/core/toolbar/src/lib/toolbar/toolbar-widget.ts`

Host-applies `@angular/aria`'s `Toolbar` (`ngToolbar`). Re-exposes its knobs so they can be pinned where the element is used (a host directive's inputs cannot be set from the wrapper's own `host` metadata):

| Input                   | Default        | Description                                                                                          |
| ----------------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `orientation`           | `'horizontal'` | Arrow-key navigation axis.                                                                           |
| `wrap`                  | `true`         | Whether arrow navigation wraps at the ends.                                                          |
| `softDisabled`          | `true`         | Keep disabled widgets focusable-but-inert (`false` skips them during navigation).                    |
| `disabled`              | `false`        | Disable the whole toolbar.                                                                           |
| `value` / `valueChange` | `[]`           | Selection model (array of selected widget values) for toggle/radio-style toolbars. Two-way bindable. |

### `MlvToolbarWidget` — `[mlvToolbarWidget]`

Host-applies `@angular/aria`'s `ToolbarWidget` (`ngToolbarWidget`) to each interactive child.

| Input      | Alias              | Default | Description                                                                                                                                                                        |
| ---------- | ------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`    | `mlvToolbarWidget` | `''`    | Widget identity, supplied through the selector attribute: `<button mlvToolbarWidget>` → `''` (action button), `<button mlvToolbarWidget="left">` → identity for a selection group. |
| `disabled` | `disabled`         | `false` | Disables this widget.                                                                                                                                                              |

**Deviation from the migration plan (`mlvNextId` synthesis):** aria `ngToolbarWidget.value` is a _required_ input, and in aria 22.0.5 a wrapper directive **cannot** feed its own host directive's input from the wrapper's `host` metadata (verified — raises `NG0950`). The value therefore can't be synthesized internally; it is exposed through the selector alias instead, which stays ergonomic (omitted → `''`) for value-less action buttons while letting selection groups supply distinct identities inline.

```html
<!-- Action toolbar: roving focus, no per-widget value needed -->
<mlv-toolbar mlvToolbarRoving>
  <button mlvButton mlvToolbarWidget>Cut</button>
  <button mlvButton variant="outlined" mlvToolbarWidget>Copy</button>
  <button mlvButton variant="outlined" mlvToolbarWidget>Paste</button>
</mlv-toolbar>

<!-- Selection group (toggle/radio-style) -->
<mlv-toolbar mlvToolbarRoving [(value)]="alignment">
  <button mlvButton mlvToolbarWidget="left">Left</button>
  <button mlvButton mlvToolbarWidget="center">Center</button>
  <button mlvButton mlvToolbarWidget="right">Right</button>
</mlv-toolbar>
```

---

## Components

### `MlvToolbar`

**File:** `libs/core/toolbar/src/lib/toolbar/toolbar.ts`
**Styles:** `libs/core/toolbar/src/lib/toolbar/toolbar.scss`

- **Selector:** `mlv-toolbar`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** Inline — `<ng-content />`

#### Inputs

| Name        | Type      | Default | Description                       |
| ----------- | --------- | ------- | --------------------------------- |
| `gap`       | `number`  | `0.25`  | Gap between items in rem          |
| `equalSize` | `boolean` | `false` | Equal flex width for all children |

#### Host Bindings

```ts
host: {
  'class': 'mlv-toolbar',
  '[style.gap.rem]': 'gap()',
  '[class.mlv-toolbar--equal]': 'equalSize()',
}
```

#### Styles

- `.mlv-toolbar` — `display: flex; flex-direction: row; align-items: center`
- `.mlv-toolbar--equal > *:not(.mlv-toolbar-spacer)` — `flex: 1 1 0`

---

### `MlvToolbarSpacer`

**File:** `libs/core/toolbar/src/lib/toolbar/toolbar-spacer.ts`

- **Selector:** `mlv-toolbar-spacer`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** Empty
- **Styles (inline):** `.mlv-toolbar-spacer { flex: 1 1 auto; }`

#### Host Bindings

```ts
host: { 'class': 'mlv-toolbar-spacer' }
```

Grows to fill all available horizontal space, pushing adjacent items to the right.

---

## Usage Examples

```html
<!-- Basic toolbar -->
<mlv-toolbar>
  <button mlvButton>Home</button>
  <button mlvButton>About</button>
</mlv-toolbar>

<!-- With spacer (items pushed to edges) -->
<mlv-toolbar>
  <button mlvButton>Menu</button>
  <mlv-toolbar-spacer />
  <button mlvButton>Profile</button>
  <button mlvButton>Logout</button>
</mlv-toolbar>

<!-- Custom gap -->
<mlv-toolbar [gap]="0.5">
  <button mlvButton>Save</button>
  <button mlvButton>Cancel</button>
</mlv-toolbar>

<!-- Equal-width items -->
<mlv-toolbar [equalSize]="true">
  <button mlvButton>Option 1</button>
  <button mlvButton>Option 2</button>
  <button mlvButton>Option 3</button>
</mlv-toolbar>
```

---

## Dependencies

- `@angular/core`
- `@angular/cdk/coercion` — `coerceBooleanProperty` for `equalSize`
- `@angular/aria/toolbar` — `Toolbar` / `ToolbarWidget` (`ngToolbar` / `ngToolbarWidget`) behind the opt-in `mlvToolbarRoving` / `mlvToolbarWidget` directives
