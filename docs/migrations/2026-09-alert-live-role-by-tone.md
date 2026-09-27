# 2026-09 — `mlv-alert` picks its live role by tone and keeps focus on dismiss

Applies to `@malva-ui/core/alert` (`MlvAlert`). Fixes #333 (audit C040,
finding H-14; owner ruling D25).

**Breaking, behaviour only.** No exported symbol, selector, input, output,
injection token, BEM class or i18n key was renamed, removed or retyped. `tone`
keeps its `MlvTone` type and its `'info'` default. Two things move at an
unchanged API: the host's `role` / `aria-live`, and where focus goes when a
dismissible alert is closed.

Classified under `VERSIONING.md` § 3 row 112, _Changed default behaviour at an
unchanged API — … focus, ARIA_. The issue cites row 111, which is the
default-value row; no input default moved. The issue also calls the focus half
a patch on its own. Row 112 names focus, and dropping focus to `<body>` was
never documented, so row 117 does not apply either. Both halves ship under the
same `!`, so the difference changes nothing. Additive, minor on their own: a
new optional `dismissFocusTarget` input (row 115) and a new exported
`MlvAlertFocusTarget` interface (row 114). On the `0.x` line a `!` commit is
demoted to a minor: `0.2.0` → `0.3.0` (§ 7).

## 1. What changed

### Live role

Every tone rendered `role="alert"` **and** `aria-live="polite"`. The two
contradict each other: `alert` is implicitly assertive. Chromium resolves the
explicit attribute, so its accessibility tree exposed every tone, danger
included, as polite. A screen reader that keys on the `alert` role (an alert
event) treats every tone as urgent, info banners included. Politeness therefore
depended on the screen reader, never on the tone.

The host now binds `[attr.role]` from the tone and writes no `aria-live`:

| tone                | role     | implicit `aria-live` |
| ------------------- | -------- | -------------------- |
| `danger`, `warning` | `alert`  | assertive            |
| `info`, `success`   | `status` | polite               |

The table in `.claude/projects/libs-alert.md` and the component JSDoc say the
same. A tone change on a rendered alert updates the role.

Measured in Chromium (Playwright, CDP `Accessibility.getPartialAXTree` on the
docs `/alert` page; filled and `outlined` give the same result):

| tone      | before: DOM `role` / `aria-live` | before: AX role / live | after: DOM `role` / `aria-live` | after: AX role / live |
| --------- | -------------------------------- | ---------------------- | ------------------------------- | --------------------- |
| `info`    | `alert` / `polite`               | alert / polite         | `status` / —                    | status / polite       |
| `success` | `alert` / `polite`               | alert / polite         | `status` / —                    | status / polite       |
| `warning` | `alert` / `polite`               | alert / polite         | `alert` / —                     | alert / assertive     |
| `danger`  | `alert` / `polite`               | alert / polite         | `alert` / —                     | alert / assertive     |

`aria-atomic` is `true` and `aria-relevant` is `additions text` in every row,
before and after. Both come from the role.

What a screen reader then says was not measured here: no screen reader runs in
this pipeline. The issue's "info banners interrupt on page load under JAWS /
NVDA" is its own reasoning. The ARIA contract is that a live region announces
changes to its content. How a region that is **inserted already filled** is
handled depends on the screen reader: inserting a `role="alert"` raises an
alert event, while a `status` inserted with its text may stay silent. See
consumer shape (d).

A **static** `role` written on `<mlv-alert>` is kept as written, as it was when
the role was a static host attribute. It is read through
`HostAttributeToken('role')` and wins over the tone.

### Focus on dismiss

The close button set `hidden` on the host while it held focus. The browser then
dropped focus to `<body>`, so a keyboard user lost their place (WCAG 2.4.3).

When focus is inside the alert at the moment it is dismissed, the alert now
moves focus out **before** it hides and before `dismissed` emits:

1. to `dismissFocusTarget`, when set and it takes focus;
2. else to the next tabbable element after the alert, in document order;
3. else to the previous one.

"Takes focus" is read back from `activeElement` after each `focus()` call, not
predicted. The browser refuses `focus()` on a disabled, `hidden`,
`display: none`, `inert` or detached element, or a button inside a disabled
`<fieldset>`, and the walk moves on to the next candidate. The alert's own
controls are never tried. When nothing takes focus, focus stays where it was
and the browser moves it off the hidden button, as before.

A `dismissFocusTarget` with no callable `focus()` is skipped. One whose
`focus()` throws is reported to the injected `ErrorHandler` and treated as
refused: the walk runs and focus lands on the next tabbable element. Neither
can leave an alert that will not close, and the order holds either way
(focus moves, then the alert hides, then `dismissed` emits). The target's
`focus()` must move focus **synchronously**: one that
defers the move reads as refused, the fallback moves focus first, and the
deferred call then moves it a second time.

Inside a shadow root the walk looks at the alert's own shadow root first; when
nothing there takes focus it continues around the shadow host in the root
above, up to the document.

**Pointer or keyboard.** Chromium and Firefox focus a button on a mouse or
touch click, so the move runs for pointer users too (WebKit does not focus a
clicked button, so there focus is not inside the alert and nothing moves). A
pointer click (`MouseEvent.detail > 0`) focuses with
`{ preventScroll: true }`: the next tabbable element can be far below the
alert, and scrolling the page to it would be a jump the user did not ask for.
Enter and Space arrive with `detail` 0 (measured in Chromium, Firefox and
WebKit, as is a scripted `el.click()`) and scroll the new focus into view, as
Tab would. An assistive-technology activation that arrives as a pointer click
moves focus without scrolling. `detail` only decides whether the page scrolls,
never whether focus moves. A component target whose `focus()` takes no options
scrolls either way.

Focus moves synchronously, while the host is still rendered, for two reasons:

- A consumer that removes the alert from its `(dismissed)` handler destroys the
  alert, and with it any after-render work the alert had scheduled.
- A consumer's `animate.leave` keeps the element in the DOM for its duration.

A `(dismissed)` handler runs after the move and can still focus something
else. Deferring the move past the render (ablated) turns two specs red: the
consumer-removal one, and the one where a `(dismissed)` handler focuses its own
target, which the late move then overrode. `mlv-alert` itself has no leave
animation and binds no `animationend`.

When focus was **not** inside the alert (a script, or a screen reader
activating the button without moving focus), the alert does not touch focus.

Measured in a real browser, on the docs `/alert` page plus a probe example
(since removed): example 2's static hide, a `@for` stack whose items are
removed from `(dismissed)`, the same stack with `animate.leave` (400 ms), and
an alert with nothing tabbable after it. "Two frames" means two
`requestAnimationFrame`s after the key press.

| case                                              | before (Chromium)                             | after (Chromium, Firefox)                                                                     | after (WebKit)                                                                 |
| ------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Enter on example 2's first close button, 2 frames | `<body>` (on the hidden button synchronously) | next alert's close button, already synchronously                                              | same as Chromium                                                               |
| mouse click on the second close button, 2 frames  | `<body>`                                      | the next tabbable element (the example's "Show sources" toggle)                               | untouched: a click does not focus a button in WebKit, so focus stays on `main` |
| consumer removes the alert from `(dismissed)`     | `<body>`                                      | next alert's close button; then past hidden, `display: none` and `inert` buttons to "Restore" | same as Chromium                                                               |
| consumer `animate.leave`, during the animation    | the fading alert's close button               | "Restore"                                                                                     | same as Chromium                                                               |
| consumer `animate.leave`, after it                | `<body>`                                      | "Restore"                                                                                     | same as Chromium                                                               |
| nothing tabbable after the alert                  | `<body>`                                      | the previous tabbable element                                                                 | same as Chromium                                                               |

Scroll, with a 3000px paragraph and then a button injected right after example
2's second alert: the page's scroll offset in Chromium / Firefox / WebKit at
1280×800. Before this change neither activation scrolled (focus fell to
`<body>`). The middle column is the same build with `preventScroll` removed,
Chromium and Firefox only; WebKit passes no options on either path.

| activation            | `preventScroll` removed | after                                                                                         |
| --------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| mouse click           | 875 → 3902 / 889 → 3916 | 875 → 875 / 889 → 889 / 875 → 875; focus on the far button, no focus ring (WebKit: not moved) |
| Enter on close button | 875 → 3902 / 889 → 3916 | 875 → 3902 / 889 → 3916 / 875 → 3900; the far button scrolled into view, with its focus ring  |

## 2. Who is affected, and what to do

In the repository, the role moves on every `info` and `success` alert:
`apps/docs` alert examples 1–4; the `data-at-scale` "Too many rows for one
scroller" banner (`data-at-scale.html:134`); and in `settings-access`, the
session alert (`info` when dismissible, `:1546`), the push-notifications notice
(`:783`), "Copy the new secret now" (`:1987`), the Danger zone's "Owner only"
notice (`:2142`, rendered by `@if (!isOwner())`) and the member drawer's
sole-owner notice (`:2513`, rendered by `@if (isSoleOwner(member.id))`). Every
`danger` / `warning` alert in `libs/` and `apps/` keeps `role="alert"`;
`settings-access.spec.ts` asserts one and still passes. No in-repo code
depended on the old focus behaviour.

**(a) A spec, selector or locator expecting `role="alert"` or
`aria-live="polite"` on an `info` / `success` alert.** An `info` /
`success` alert now has `role="status"` and no `aria-live` attribute;
`danger` / `warning` alerts have `role="alert"` and no `aria-live`.
`getByRole('alert')` no longer finds an info banner, and a
`[aria-live="polite"]` selector finds no alert.
**Do:** select the alert by its BEM block (`.mlv-alert`,
`.mlv-alert--tone-info`) or by role and name (`getByRole('status', { name })`).
Assert the role the table above gives for the tone.

**(b) An info or success alert that must interrupt.** It no longer does.
**Do:** use `tone="warning"` / `"danger"` when the message is urgent, or write
a static `role="alert"` on the element, which is kept as written.

**(c) A host `[attr.role]` binding.** The host now binds `[attr.role]` itself.
A host binding runs after the parent template's bindings on the first pass, so
it wins then; after that, whichever value last changed wins. Measured on an
`info` alert with a consumer `[attr.role]="role()"` starting at `'region'` and
later set to `'note'`: the first render now shows `status` (before this change:
`region` — the consumer's value overwrote the old static `role="alert"`), and
`note` appears once the consumer's value changes, before and after.
**Do:** write the role statically (`role="note"`). A static attribute is read
once at construction and always wins.

**(d) An info / success confirmation inserted with its text** — typically
`@if (saved()) { <mlv-alert tone="success">Saved</mlv-alert> }`. As
`role="alert"` it raised an alert event on insertion; as `role="status"` some
screen readers stay silent on an inserted, already-filled region. In the
repository this is, most prominently, the `data-at-scale` "Too many rows for
one scroller" banner: `@if (!virtualScrollFits())` inserts it when the user
raises the row count, and it is the page's only explanation of the switch from
virtual scrolling to pages. The `settings-access` session alert ("Session
revoked" with Undo), "Copy the new secret now", "Owner only" and the sole-owner
drawer notice are the same shape. None was measured with a screen reader; a
manual pass is a follow-up.
**Do:** keep the alert rendered and change its text (a live region announces
changes), announce the message through CDK `LiveAnnouncer`, or pick a tone
whose role raises an event if it really is urgent (b).

**(e) A `(dismissed)` handler that moves focus.** Unchanged: it runs after the
alert's own move and wins.
**Do:** nothing.

**(f) Code or specs that expected focus on `<body>` (or on the hidden close
button, in jsdom) after dismissal.** Focus is now on the next tabbable element
after the alert, else the previous one — for keyboard users, and in Chromium and
Firefox for mouse and touch users too. A pointer dismiss does not scroll (see
_Pointer or keyboard_ above); a keyboard one scrolls the new focus into view.
The landing element still receives `focus` / `focusin` on the pointer path, so
anything it opens on focus now opens for a mouse user who clicked the close
button: an `[mlvTooltip]` host shows its tooltip, and so does a
`mlvPopupTrigger` with `triggerOn="focus"`.
**Do:** assert the element focus should land on; a spec that simulates a mouse
dismiss dispatches a click with `detail: 1`. To choose the element, bind
`dismissFocusTarget` to any object with `focus()`: an element, or a component
that exposes `focus()`. When the next control opens something on focus, point
`dismissFocusTarget` at a calmer target (a heading with `tabindex="-1"`, the
section's container).

**(g) A template reference to a component without `focus()` as
`dismissFocusTarget`.** `#ref` on a component host resolves to the component,
not its element. `button[mlvButton]`, `mlv-select`, `mlv-textarea`,
`mlv-number-input`, `mlv-combobox` and the date / time pickers expose no
`focus()`; strict templates reject them (TS2322). A non-strict template, or a
target set from code, compiles, and at run time the alert skips the target and
uses the fallback.
**Do:** pass the element — `viewChild('ref', { read: ElementRef })` →
`.nativeElement` — or, for a component that does expose `focus()`
(`mlv-input`, `mlv-checkbox`, `mlv-switch`, `mlv-radio`), the reference.

## 3. Not changed

- A **static** `role` on `<mlv-alert>` is kept as written (`role="note"`,
  `role="none"`), whatever the tone. A spec pins it.
- `danger` / `warning` alerts keep `role="alert"`; only the contradictory
  `aria-live="polite"` beside it is gone.
- Dismissal still sets `hidden` and `mlv-alert--dismissed` on the host and
  emits `dismissed` once. A dismissed alert still cannot be re-shown (no
  API; follow-up).
- The dismiss button, its `Dismiss alert` label (the `dismiss` key of
  `MlvAlertI18n`),
  every BEM class and every `--mlv-alert-*` custom property.
- An alert dismissed while focus is elsewhere leaves focus alone.
