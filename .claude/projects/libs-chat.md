# @malva-ui/core/chat

> **Keep this file up to date.** Whenever the component API, behavior, or styling changes, update this file.

**Path:** `libs/core/chat`
**Import path:** `@malva-ui/core/chat` (also re-exported from `@malva-ui/core`)
**Nx project:** `core-chat` — `lint` + `test` targets

Data-driven chat surface. `mlv-chat` renders an oldest→newest `messages` array as author groups with date separators, delivery ticks, embedded reply quotes, an image/gif/video grid, audio playback, a typing indicator, loading skeletons, appear/removal animations, and reverse infinite pagination. Grouping and date insertion are computed internally — consumers only supply flat data.

**Naming:** the bubble component is `MlvChatMessage`; the message _data_ interface is **`MlvChatMessageData`**. The `mlv-message` selector and `.mlv-message` BEM block are already owned by `MlvMessage` in `@malva-ui/core/form-utils`, which is why the lib is `chat` (not `message`) and every selector is `mlv-chat-*`.

---

## Public API

| Export                                                                     | Kind                 | Description                                                                                             |
| -------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| `MlvChat`                                                                  | Component            | `mlv-chat` — scroll container and renderer                                                              |
| `MlvChatMessage`                                                           | Component            | `mlv-chat-message` — one bubble; rendered internally, usable alone                                      |
| `MlvChatMessageDef`                                                        | Structural directive | `[mlvChatMessageDef]` — custom bubble body per message `type`                                           |
| `MlvChatAuthorDef`                                                         | Structural directive | `[mlvChatAuthorDef]` — custom author slot above other-authored groups                                   |
| `MlvChatDateDef`                                                           | Structural directive | `[mlvChatDateDef]` — custom date separator                                                              |
| `MlvChatMessageData<TData>`                                                | Interface            | One message                                                                                             |
| `MlvChatUser`, `MlvChatAttachment`                                         | Interfaces           | Participant / attachment                                                                                |
| `MlvChatMessageStatus`, `MlvChatGroupPosition`                             | Types                | `'sending' \| 'sent' \| 'delivered' \| 'read' \| 'failed'`; `'single' \| 'first' \| 'middle' \| 'last'` |
| `MlvChatRenderItem`, `MlvChatRenderMessage`                                | Types                | Output of `buildChatRenderList`                                                                         |
| `MlvChatMessageDefContext`, `MlvChatMessageDefRef`                         | Interfaces           | Template context / registered def                                                                       |
| `MlvChatAuthorDefContext`, `MlvChatDateDefContext`                         | Interfaces           | Template contexts                                                                                       |
| `MLV_CHAT_USERS`, `MLV_CHAT_MESSAGE_DEFS`                                  | Injection tokens     | Container→bubble wiring                                                                                 |
| `buildChatRenderList`, `toChatDate`, `isSameChatDay`, `formatChatDuration` | Functions            | Pure helpers (also used by the internals)                                                               |

**Internal, deliberately not exported:** `MlvChatMediaGrid`, `MlvChatAudio`, `MlvChatAudioService`, `MLV_CHAT_AUDIO_FACTORY`, `MlvChatDate`, `MlvChatTyping`.

---

## `MlvChat`

**Files:** `libs/core/chat/src/lib/chat/{chat.ts,chat.html,chat.scss}`
**Selector:** `mlv-chat` · `ViewEncapsulation.None` · OnPush

### Inputs

| Input            | Type                   | Default  | Description                                            |
| ---------------- | ---------------------- | -------- | ------------------------------------------------------ |
| `messages`       | `MlvChatMessageData[]` | required | Ordered oldest → newest                                |
| `selfId`         | `string`               | required | Messages with this `authorId` render as own            |
| `users`          | `MlvChatUser[]`        | `[]`     | Avatars, author names, typing names                    |
| `loading`        | `BooleanInput`         | `false`  | Skeleton bubbles instead of content                    |
| `loadingOlder`   | `BooleanInput`         | `false`  | Top spinner; also suppresses further `loadOlder`       |
| `hasOlder`       | `BooleanInput`         | `false`  | Gates `loadOlder`                                      |
| `typingUsers`    | `string[]`             | `[]`     | Ids resolved against `users`; unknown ids are dropped  |
| `groupWindow`    | `number`               | `5`      | Max gap in minutes inside one author group             |
| `showAuthors`    | `'auto' \| boolean`    | `'auto'` | `'auto'` shows the author slot once `users.length > 2` |
| `dateSeparators` | `BooleanInput`         | `true`   | Calendar-day separators                                |
| `windowSize`     | `number`               | `150`    | Newest messages kept in the DOM                        |
| `mlvDensity`     | `MlvDensity`           | ambient  | Via `MlvDensityDirective` host directive               |

### Outputs

| Output       | Payload                   | When                                           |
| ------------ | ------------------------- | ---------------------------------------------- |
| `loadOlder`  | `void`                    | Near the top, window exhausted, `hasOlder` set |
| `retry`      | `MlvChatMessageData`      | Retry on a failed own message                  |
| `mediaClick` | `{ message, attachment }` | A media cell was activated                     |
| `replyClick` | `{ message, replyTo }`    | A reply quote was activated                    |

### Providers / host directives

`MlvChatAudioService` (per-chat playback exclusivity), `MLV_DENSITY_ELEMENT: 'chat'`, `MLV_CHAT_USERS`, `MLV_CHAT_MESSAGE_DEFS`; host directive `MlvDensityDirective` (input `mlvDensity`).

---

## `MlvChatMessage`

**Files:** `libs/core/chat/src/lib/chat-message/{chat-message.ts,chat-message.html,chat-message.scss}`

| Input           | Type                   | Default    | Description                                              |
| --------------- | ---------------------- | ---------- | -------------------------------------------------------- |
| `message`       | `MlvChatMessageData`   | required   | The message                                              |
| `own`           | `BooleanInput`         | `false`    | Right-aligned accent bubble; ticks render only when true |
| `groupPosition` | `MlvChatGroupPosition` | `'single'` | Corner-tail radii                                        |
| `quote`         | `BooleanInput`         | `false`    | Condensed reply-quote rendering                          |

Outputs: `retry: void`, `mediaClick: MlvChatAttachment`, `replyClick: MlvChatMessageData`.

Content order inside the bubble: reply quote → media grid → audio players → text → meta row (time + ticks; retry button when `failed`).

---

## Behavior

### Grouping (`buildChatRenderList`)

Pure function in `chat-render-list.ts`. Breaks a group on author change, on a gap larger than `groupWindow` minutes, and always at a calendar-day boundary. Emits `{ kind: 'date' }` items (ids `date-YYYY-M-D`) and `{ kind: 'group' }` items (ids `group-<first message id>`) with each message's `position`.

### Scroll engine

Native scroll plus `content-visibility: auto` on group rows (no view recycling, so animations and reading order stay intact).

- Pinned when within 48px of the bottom. Appending while pinned smooth-scrolls down; while unpinned it increments the "N new messages" pill.
- Pinning is re-applied from a `MlvResizeObserverService` subscription on the inner `.mlv-chat__content` wrapper, not from renders alone — media loading late and `content-visibility` revealing height both change the scroll height without a change-detection pass.
- Within 150px of the top the render window grows by 50 messages; once the window covers the whole array and `hasOlder` is set (and `loadingOlder` is not), `loadOlder` fires.
- Prepending compensates the scroll position by the height delta (captured before render, applied in an `afterRenderEffect`).
- Re-pinning trims the window back to `windowSize` and clears the pill.
- `_evaluateScroll(scrollTop, scrollHeight, clientHeight)` holds the logic separately from DOM measurement so it is testable without layout.

**Listener wiring (issues #73 / #7).** The scroll listener is registered
outside the template on `MlvScrollbar.viewportElement` — the element that
genuinely scrolls — as `fromEvent(viewport, 'scroll', { passive: true })` from
`afterNextRender`, inside `runOutsideAngular`, torn down with
`takeUntilDestroyed(this._destroyRef)` (the `DestroyRef` is passed explicitly
because an `afterNextRender` callback is not an injection context). There is no
`(scroll)` binding in `chat.html` and `_onScroll` is `private`.

It previously sat as `(scroll)` on the `<mlv-scrollbar>` **host**, which is the
parent of `.mlv-scrollbar__viewport`. `scroll` does not bubble and
`MlvScrollbar` declares no `scroll` output, so that was a plain native listener
on a node that never receives the event: scrolling the chat did nothing at all —
`loadOlder` never fired, the render window never grew, and bottom-distance
tracking never updated. Binding outside the template also removes the per-event
change-detection pass Angular's template-listener wrapper schedules
unconditionally (20 scroll events over an unchanged view: 0 passes, was 20).

`chat-scroll.spec.ts` still drives `_evaluateScroll(...)` directly, by design.
The wiring itself is covered separately by `chat-scroll-wiring.spec.ts`, whose
every case dispatches a native event **at `viewportElement`** — dispatching at
the `mlv-scrollbar` host passes vacuously, because `dispatchEvent` runs a node's
own listeners regardless of bubbling, which is exactly how the bug survived.

### Replies — the citation block

`replyTo` carries a **full** `MlvChatMessageData`, not an id — so a citation renders correctly even when the original sits outside the loaded pages. The citation is the same bubble in `quote` mode (clamped text, thumbnail, audio chip, no meta), wrapped in a `button.mlv-chat-message__reply` that emits `replyClick`. Recursion is one level deep: a quoted message with its own `replyTo` shows a `↩` marker (`__reply-marker`) instead of nesting.

**Palette inheritance.** The citation is a _second_ `mlv-chat-message` host, so it redeclares every `--mlv-chat-message-*` variable and can never inherit the parent bubble's values through that prefix. The citation therefore reads a separate set declared on `.mlv-chat-message__reply` — an ancestor that does not redeclare them:

| Variable                         | Default                                                | Purpose                            |
| -------------------------------- | ------------------------------------------------------ | ---------------------------------- |
| `--mlv-chat-quote-surface`       | `color-mix(--mlv-chat-message-color 8%, transparent)`  | Citation background                |
| `--mlv-chat-quote-surface-hover` | `color-mix(--mlv-chat-message-color 14%, transparent)` | Hover state of the citation button |
| `--mlv-chat-quote-accent`        | `--mlv-background-accent-1`                            | Leading bar                        |
| `--mlv-chat-quote-author`        | `--mlv-text-action`                                    | Quoted author name                 |
| `--mlv-chat-quote-fg`            | `--mlv-chat-message-color`                             | Quoted text and the audio chip     |

Deriving the surface from the _parent bubble's own text colour_ is what makes one rule set cover the neutral other-bubble and the accent own-bubble in both themes — it is always a tint of something already legible on that bubble. `.mlv-chat-message--own .mlv-chat-message__reply` additionally remaps the accent, the author colour and `--mlv-border-focus` to `--mlv-text-primary-on-accent-1`, because the global action blue would otherwise sit blue-on-blue.

The button carries its own background, border reset and focus ring: without them a bare `<button>` renders the UA `buttonface` surface, which is light in **both** themes.

### Media

1 item large (aspect ratio reserved from `width`/`height`), 2–4 in a 2-column grid, >4 collapses to four cells with a `+N` overlay. Skeleton per image until `load`. `video` renders poster + play badge + duration chip (no inline player); `gif` autoplays muted on a loop. `uploadProgress` dims the cell and overlays `mlv-progress`.

**Muting a `<video>` takes both halves** (#136). Each `<video>` carries:

- a **static `muted` attribute** in the template — serialises into the server payload, so an autoplaying `gif` cell cannot make noise between parse and hydration. It replaces a `[muted]="true"` property binding that could never serialise and logged one NG0303 per rendered `<video>` on every server render (`'muted' in element` is `false` on domino's `HTMLVideoElement` — the `indeterminate` defect class of #124);
- **`MlvChatMutedVideo`** (`video[mlvChatMuted]`, `chat-media-grid/chat-muted-video.ts`, not exported from the barrel) — a constructor-only directive writing `nativeElement.muted = true`. That live property is what actually silences an element the browser created with `createElement` rather than the parser, and what Chrome's muted-autoplay allowance reads; without it the `gif` cell is an unmuted `autoplay` video the browser refuses to play. Not a template binding, so it never reaches the check that raises NG0303; on the server it writes a harmless expando and changes no markup.

The second half is an **engine divergence in flight, not a spec invariant** — when every targeted engine has landed the change, delete the directive and keep the attribute. The current HTML Standard gives a media element a tristate `muted state` (`true`/`false`/`"default"`, initially `"default"`) and calls the element muted when its state is `"default"` **and** it has a `muted` content attribute, so under that text `createElement` + `setAttribute` already reports `muted === true`. Gecko implemented it in Firefox 153 (bugzilla 2037015); Chromium and jsdom 22 have not — measured in Chrome 152, `createElement` + `setAttribute` leaves `muted === false`, and a parsed `<video muted>` still reports `muted === true` after `removeAttribute('muted')`, which only the older one-time-transfer model produces.

A **directive rather than an `afterRenderEffect` on the grid**: `mlv-chat` does not virtualise, so a long thread holds one live grid per message carrying media plus one per quoted reply, and one after-render sequence per grid would be walked on every `ApplicationRef.tick()` — the repeated-child-element cost `libs/core/CLAUDE.md` warns about. A constructor write costs nothing after creation and covers a cell that arrives on a later render for free, because that cell is a new element with its own directive instance.

`playsinline` stays a plain static attribute: unlike `muted`, `HTMLVideoElement.playsInline` **is** a live reflection of its content attribute, so `setAttribute` after creation is enough, and a static attribute never reaches the property check that produces NG0303.

### Audio

Native `HTMLAudioElement` created lazily through `MLV_CHAT_AUDIO_FACTORY` (overridable in tests). `MlvChatAudioService` is provided by `mlv-chat`, so only one audio message plays per chat; a standalone bubble injects it optionally and plays without coordination.

Its three element listeners (`timeupdate`, `loadedmetadata`, `ended`) are `fromEvent(...).pipe(takeUntilDestroyed(this._destroyRef))`, so teardown is explicit rather than implied by the element becoming garbage. `_ensureAudio()` runs from the toggle click handler, **not** an injection context, so the `DestroyRef` is captured as a field and passed to `takeUntilDestroyed()` explicitly — the bare call throws there.

**Playback position is floored to whole seconds** on the `timeupdate` write (`_currentTime.set(Math.floor(audio.currentTime))`):

- `mlv-slider` defaults to `step = 1`, and its two **pointer** paths snap through `_snap()` — so pointer scrubbing was already whole-second granular, and flooring makes playback match it.
- **Keyboard** stepping does not snap: `_computeKeyValue` returns `_clamp(current ± step)`, and `Home`/`End` return raw `min`/`max`. From a fractional position ArrowRight went `61.2` → `62.2`. Flooring the playback write therefore also lands keyboard stepping on integers (`61` → `62`), which is a second improvement rather than parity with an existing behaviour.
- The slider clamps but does not snap its bound `value`, so an unfloored position rendered a fractional `aria-valuenow` on a `step="1"` slider. Flooring fixes that **for the playback path only** — `max` is bound to `_duration()`, i.e. the raw unfloored `audio.duration`, so `aria-valuemax` can still be off-step and `End` can still drive the value off-step. Pre-existing and untouched here.
- **The visible readout is unchanged**, not approximately: `formatChatDuration` floors its own input, so `formatChatDuration(Math.floor(x)) === formatChatDuration(x)` for every input, negatives / `NaN` / `Infinity` / `-0` included. `chat-audio.spec.ts` asserts the identity and re-renders a table of raw positions against it rather than claiming it.
- `timeupdate` is observed at roughly 4 Hz in current Chrome/Firefox/Safari; the HTML spec permits a wider 15-250 ms window, so treat the rate as an observation, not a guarantee. At that rate roughly **three of every four ticks become equal-value signal writes**, and signal equality short-circuits those to zero change detection. Pinned in the spec by counting `afterEveryRender` passes: four ticks inside one second → 1 pass, crossing the boundary → 1 more.
- Only the playback tick is quantized. `_seek()` writes the exact value it receives to both `_currentTime` and `audio.currentTime` so the thumb tracks a drag, and `ended` still resets to exactly `0`.

Scope note: only this component's own view was ever re-checked per tick, not the application — sibling OnPush views are untouched by a signal write here. `runOutsideAngular` is deliberately **not** used: Angular's hybrid scheduler is notified by the signal write itself, so suppressing the zone tick changes nothing. A throwaway probe during review measured 20 in-zone and 20 out-of-zone writes both producing 20 passes; that probe is not preserved in the suite, so take it as the reason for the decision rather than as a pinned invariant. What the suite does pin is the counterfactual that matters: the same four raw fractional values written unfloored cost 4 passes against the floored path's 1. Equal-value writes are the only lever that works.

### Animations

Only live-appended messages animate in — ids are recorded in `_liveIds` when the array's last id changes, so initial load, window growth, and prepended history render instantly. Enter: grid-rows collapse + fade + translateY (`--mlv-duration-slow`, `--mlv-ease-out-strong`). Leave via `animate.leave="mlv-chat__item--leave"`. `@include mixins.reduced-motion` on `mlv-chat`, `mlv-chat-message`, and `mlv-chat-typing`.

---

## Accessibility

- Viewport: `role="log"` (polite by default), i18n `aria-label`, `tabindex="0"`.
- Each message is an `<article>` labelled `"{author}, {time}, {status}"`; status icons are `aria-hidden`.
- Retry and media cells are real buttons with accessible names; images always carry `alt` (i18n fallback).
- Covered by `chat-a11y.spec.ts` (targeted `axe-core` rules plus structural assertions).

---

## i18n

Token `MLV_CHAT_I18N` (`libs/i18n/src/lib/tokens/chat.ts`). Keys: `chatLabel`, `today`, `yesterday`, `statusSending`, `statusSent`, `statusDelivered`, `statusRead`, `statusFailed`, `retry`, `newMessages` (ICU `{count}`), `typing` (ICU `{count}`), `playAudio`, `pauseAudio`, `imageFallbackAlt`, `moreMedia` (ICU `{count}`), `loadingOlder`. Shipped in all fourteen locale packs (de, en, es, fr, id, it, ja, nl, pl, pt, ro, tr, uk, zh-Hans).

---

## Styling

BEM blocks `.mlv-chat`, `.mlv-chat-message`, `.mlv-chat-media-grid`, `.mlv-chat-audio`, `.mlv-chat-date`, `.mlv-chat-typing`. The group avatar is `position: sticky; inset-block-end: 0`, so a tall run keeps its avatar in view. Because the global `[class*='mlv']` reset drops inherited colour, `__text`, `__meta`, `__time`, and `__status` each restate `--mlv-chat-message-color`; the read tick is the full-strength bubble colour (ticks only render on the accent own-bubble, where an info hue would sit blue-on-blue). State-driven custom properties only: `--mlv-chat-gap`, `--mlv-chat-padding`, `--mlv-chat-bubble-gap` (density), `--mlv-chat-message-bg/-color/-radius/-tail-radius` (own/other/failed), and the `--mlv-chat-quote-*` citation set declared on `__reply` (see **Replies**). Density levels tight → airy via `density.scss` mixins, comfortable being the base.

---

## Dependencies

`@angular/{core,common,cdk}`, `@lucide/angular`, `@malva-ui/cdk/density`, `@malva-ui/i18n`, and the `@malva-ui/core` leaves `avatar`, `button`, `loader`, `progress`, `skeleton`, `slider`.
