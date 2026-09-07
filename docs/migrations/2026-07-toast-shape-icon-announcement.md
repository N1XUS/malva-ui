# 2026-07 — Toast shape, tone icon, and announcement rework

Applies to `@malva-ui/core/toast` and `@malva-ui/core/notification`.

## Breaking

| Removed                                                                          | Replacement                                                |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `resolveToastRole(tone)` → `'alert' \| 'status'`                                 | `resolveToastPoliteness(tone)` → `'polite' \| 'assertive'` |
| `role="alert"` / `role="status"` on `mlv-toast-item` and `mlv-notification-item` | nothing — announcement moved to the CDK `LiveAnnouncer`    |

Supersedes the `resolveToastRole` entry in
[2026-07-api-unification-tone-size.md](2026-07-api-unification-tone-size.md), which
records that function as it existed at the time.

### Announcement moved to `LiveAnnouncer`

Items no longer carry live-region semantics. `MlvAbstractToastService` announces through
the CDK `LiveAnnouncer` via a new abstract `resolveAnnouncement(config)` hook. This fixes
three defects:

- a live region inserted together with its first message is frequently missed by screen
  readers — `LiveAnnouncer` owns a region that already exists in the DOM;
- a `role` per item turned a stack of N items into N live regions;
- `role="alert"` carries an implicit `aria-live="assertive"` that silently overruled any
  caller-specified politeness.

New `MlvBaseToastConfig.politeness?: MlvToastPoliteness` overrides the tone-derived
default. Template and component content is **not** announced — the service cannot read its
rendered text, so such content announces its own.

**Required stylesheet.** `LiveAnnouncer` appends a `.cdk-visually-hidden` element to the
body. Those rules are now emitted into the package's global `styles/malva-ui.css`. A
consumer that does not include that stylesheet **will see the announcement text rendered
visibly on the page.**

Notification additionally announces its action labels: a notification never takes focus, so
a screen-reader user must be told an action exists.

## Additions

| API                                                                           | Description                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `MlvToastShape`                                                               | `'default'` rectangle or `'pill'` fully rounded compact bar |
| `MlvToastConfig.shape` / `MlvToastOpenConfig.shape`                           | Toast-only; `MlvNotificationConfig` is unchanged            |
| `MlvToastConfig.icon` / `MlvToastOpenConfig.icon`                             | Renders the tone-derived Lucide icon                        |
| `MlvToastPoliteness`, `joinAnnouncementParts()`, `MLV_TOAST_DEFAULT_POSITION` | Announcement helpers and the single default-position source |

`icon` was previously declared but never implemented — and the template interpolated the
raw flag, so `open()` (which defaulted it to `true`) rendered the literal text **"true"**
next to the close button. The icon is now real, opt-in, and derived from `tone`:
`success`→`lucideCheckCircle`, `warning`→`lucideTriangleAlert`, `danger`→`lucideCircleX`,
`info`→`lucideInfo`. `tone: 'default'` has no glyph, so `icon: true` is a no-op there.
It is always suppressed for template/component content, which supplies its own leading
icon through `[mlvToastIcon]` — a directive that previously existed but was inert (no
styles, referenced nowhere).

## Behaviour changes

- **`.mlv-toast-item` now hugs its content**: `width: fit-content` with
  `max-width: min(22.5rem, calc(100vw - 2rem))`, replacing the fixed `22.5rem`. The panel
  and container align items from `--mlv-toast-align`, resolved per position class, so a
  short toast still sits against its anchor edge.
- `MlvToastTimer.pause()` is now an explicit alias of `clear()`. It never tracked remaining
  time; the previous JSDoc claimed it preserved the callback, which was untrue. Leaving
  hover/focus still restarts the full `displayTime`.
- The five tone modifiers no longer declare `--mlv-toast-indicator-bg`; nothing consumed it
  (there is no indicator element in the template).

## Not changed

Concurrent toasts remain uncapped, and auto-dismiss defaults stay at 4000 ms (toast) /
6000 ms (notification) for every tone. Both were considered and deliberately left as-is.
Note that a tall stack can still overflow the overlay's `max-height` without a scroll
affordance.
