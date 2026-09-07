# API Unification — Semantic Tone & Size Vocabulary (2026-07)

Pre-1.0 breaking rename. No deprecated aliases were kept — every call site was updated. This note is the old → new reference for downstream consumers.

## Part 1 — Semantic tone

A single shared type now backs every display-surface "semantic colour" concept:

```ts
// @malva-ui/cdk/utils (barrel-exported)
export type MlvTone = 'info' | 'success' | 'warning' | 'danger';
```

Components that need extra, non-semantic options extend it locally (e.g. `type BadgeTone = MlvTone | 'default' | 'primary' | 'secondary' | 'accent'`).

### Input name → `tone` (display surfaces)

| Component                                       | Old input      | New input     | Old type              | New type                                                                     |
| ----------------------------------------------- | -------------- | ------------- | --------------------- | ---------------------------------------------------------------------------- |
| `mlv-alert`                                     | `severity`     | `tone`        | `AlertSeverity`       | `MlvTone` (type removed)                                                     |
| `mlv-toast-item` / `ToastService`               | `variant`      | `tone`        | `ToastVariant`        | `ToastTone` (`MlvTone \| 'default'`)                                         |
| `mlv-notification-item` / `NotificationService` | `variant`      | `tone`        | `NotificationVariant` | `NotificationTone` (`MlvTone \| 'default'`)                                  |
| `mlv-timeline-item`                             | `variant`      | `tone`        | `TimelineItemVariant` | `TimelineItemTone` (`MlvTone \| 'default'`)                                  |
| `mlv-tile`                                      | `state`        | `tone`        | `TileState`           | `TileTone` (`MlvTone \| 'default'`)                                          |
| `mlv-loader`                                    | `state`        | `tone`        | `LoaderState`         | `LoaderTone` (`MlvTone \| 'default'`)                                        |
| `mlv-progress`                                  | `state`        | `tone`        | `ProgressState`       | `ProgressTone` (`MlvTone \| 'default'`)                                      |
| `mlv-badge`                                     | `color`        | `tone`        | `BadgeColor`          | `BadgeTone` (`MlvTone \| 'default' \| 'primary' \| 'secondary' \| 'accent'`) |
| `mlv-chip`                                      | `color`        | `tone`        | `ChipColor`           | `ChipTone` (`MlvTone \| 'default' \| 'primary' \| 'secondary' \| 'accent'`)  |
| `[mlvTooltip]`                                  | `tooltipColor` | `tooltipTone` | `TooltipColor`        | `TooltipTone` (`MlvTone \| 'dark' \| 'light' \| 'primary'`)                  |
| `mlv-tooltip-panel` (internal)                  | `color`        | `tone`        | `TooltipColor`        | `TooltipTone`                                                                |

### Value vocabulary

| Old value       | New value  | Where                                                                                                                                                                                                                                                                      |
| --------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'error'`       | `'danger'` | toast, notification, tile, timeline tone unions + their SCSS modifiers                                                                                                                                                                                                     |
| `'information'` | `'info'`   | `FormState` and every mirror (`InputState`, `SelectState`, `CheckboxState`/`CheckboxGroupState`, `SwitchState`/`SwitchGroupState`, `DayPickerState`, `TimePickerState`, `DateRangePickerState`) + SCSS `--information` / `--state-information` → `--info` / `--state-info` |

### Services

- `ToastService.variant(v, …)` → `ToastService.tone(v, …)`; `NotificationService.variant(v, …)` → `NotificationService.tone(v, …)`.
- Config field `variant` → `tone` on `ToastConfig` / `NotificationConfig` (`InternalToast` / `InternalNotification` too).
- `resolveToastRole(variant)` → `resolveToastRole(tone)` — same name, param renamed, now returns `'alert'` for `danger`/`warning`.
- `ToastService.error()` / `NotificationService.error()` convenience methods keep their names but now emit `tone: 'danger'`.

### BEM modifiers

`--severity-*` → `--tone-*` (alert), `--state-*` → `--tone-*` (tile), `--color-*` → `--tone-*` (badge, chip, tooltip). Value-encoded modifiers (`mlv-toast-item--error`, `mlv-loader--error`) → `--danger`; `--information` → `--info`.

### Intentional exclusions (documented in their CLAUDE.md)

| Kept as-is                                                      | Why                                                                                    |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `FormState` input name `state` + member `'error'`               | Form-validation semantics, not visual tone. (Only `'information'` → `'info'` changed.) |
| `StepState` (`'pending' \| 'active' \| 'completed' \| 'error'`) | Step lifecycle, not a tone.                                                            |
| `ButtonVariant` members `'error' \| 'warning' \| 'info'`        | Button is not a display-tone surface; out of scope.                                    |
| `NotificationAction.variant` (`'primary' \| 'secondary'`)       | Action-button variant, not the notification tone.                                      |

## Part 2 — Size vocabulary

Letter scale `xs | s | m | l | xl`, default `'m'`.

| Type               | Old union                                                  | New union                           | Old default | New default |
| ------------------ | ---------------------------------------------------------- | ----------------------------------- | ----------- | ----------- |
| `ButtonSize` ¹     | `'x-small' \| 'small' \| 'normal' \| 'large' \| 'x-large'` | `'xs' \| 's' \| 'm' \| 'l' \| 'xl'` | `'normal'`  | `'m'`       |
| `ProgressSize`     | `'small' \| 'medium' \| 'large'`                           | `'s' \| 'm' \| 'l'`                 | `'medium'`  | `'m'`       |
| `DialogSizePreset` | `'small' \| 'medium' \| 'large' \| 'fullscreen'`           | `'s' \| 'm' \| 'l' \| 'fullscreen'` | `'medium'`  | `'m'`       |

> ¹ **Superseded (2026-07-21):** `ButtonSize` and the button `size` input were **removed**. The input was never wired to any class or style — button sizing is driven entirely by the `@malva-ui/cdk/density` system (`mlvDensity`). The rename above was applied at the time but the whole input was later found to be dead and deleted.

`DialogService` `DEFAULT_SIZE_PRESETS` keys and the `DialogComponent` `size` input default were renamed accordingly (`small`/`medium`/`large` → `s`/`m`/`l`).

### Left as-is (documented)

- `drawer` `size` — a raw CSS length string (`'300px'`).
- `loader` `size` / `split-pane` `size` — numeric.
- `avatar` `AvatarSize` — already letter scale, keeps its extended `'xxl'`.
- `card` `CardSize`, `tile` `TileSize` — already letter scale.
