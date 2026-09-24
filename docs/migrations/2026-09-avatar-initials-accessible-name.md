# 2026-09 — an initials-only `mlv-avatar` is named by its initials, and a new `src` loads again

Applies to `@malva-ui/core/avatar` (`MlvAvatar`) and, through it, the `+N`
counter of `@malva-ui/core/avatar-group` (`MlvAvatarGroup`). Fixes #334 (audit
C042 / H-16).

**Breaking, behaviour only.** No exported symbol, selector, input, output,
model, injection token, BEM class, `--mlv-*` token or i18n key was renamed,
removed or retyped. `name`, `label`, `initials` and `src` keep their names,
types and defaults. What moves is the ARIA an avatar renders when it has
initials but no `name` and no `label`, and what a new `src` does after an
earlier one loaded or failed.

Classified under `VERSIONING.md` § 3:

- **Row 112** — _Changed default behaviour at an unchanged API — … ARIA_ — for
  the name. Nothing documented the new output: the component's own notes said
  an initials-only avatar omits the role. An initials-only avatar is now in the
  accessibility tree: a control that computes its name from its content (a
  button, a link, an option) now includes the initials of an avatar inside it,
  and a row that is not a control (a list item, a chat bubble, a card) gains an
  image reading stop beside the person's name.
- **Row 117** — _Bug fix that restores documented behaviour_ — for the image:
  `src` is documented as "When provided, the avatar displays an image", and a
  new URL now does.

On the `0.x` line a `!` commit is demoted to a minor: `0.1.15` → `0.2.0` (§ 7).

## 1. What changed

**The name.** `_accessibleName()` was `name || label || null`, and the host
wrote `role="img"` + `aria-label` only when it was set. The initials span is
`aria-hidden`, so `<mlv-avatar initials="JD" />` rendered no role, no name and
nothing the accessibility tree could reach. The chain is now
`name || label || initials || null` (each trimmed; `initials` meaning the
resolved initials — explicit, else derived from `name`, which already won).
The initials are also upper-cased, because `.mlv-avatar__initials` paints them
with `text-transform: uppercase`: `initials="me"` shows "ME" and is named "ME"
(the same locale-independent `toUpperCase()` `deriveInitials` uses, so derived
and explicit initials agree). CSS uppercasing follows the inherited `lang` and
`toUpperCase()` does not, so on a Turkish, Azerbaijani, Greek or Lithuanian
page lowercase initials can paint differently from the spoken name (measured in
review, Chromium 145 and Firefox 146: tr/az `i` paints `İ` and is spoken `I`,
el drops the tonos, lt drops the dot above; `ß` agrees, "SS"); pass initials
already upper-cased in the page's language. `toLocaleUpperCase(lang)` is not
used because V8 and SpiderMonkey disagree on `el`. `name` and `label` stay as
authored. The initials name the avatar whether an image
covers them or not, so the name does not change when an image loads or fails.

**The image.** `_imageLoaded` and `_imageError` were plain signals set by the
first `load` / `error` and never tied to `src`. One failed URL disabled images
on that avatar for good — a recycled list row, or a re-upload after a 404, kept
showing initials — and one successful load left the next URL with no skeleton
and already carrying `.mlv-avatar__image--loaded`. Both are now `linkedSignal`s
over `src`, so every new URL starts unloaded: skeleton back, `<img>` rendered,
fade-in again.

Measured with Chromium 145 (CDP `Accessibility.getFullAXTree`) and Firefox 146
(WebDriver BiDi `browsingContext.locateNodes` with an `accessibility` locator,
which asks Gecko's own a11y service) on the rendered markup; both engines agree
on every row:

| Markup                                                                                  | Before                                    | After                                                   |
| --------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `<mlv-avatar initials="JD" />`                                                          | nothing in the tree                       | `image "JD"`                                            |
| `<mlv-avatar initials="AJ" src="…" />`                                                  | nothing in the tree                       | `image "AJ"`                                            |
| `<button mlvButton><mlv-avatar *mlvButtonBefore initials="AJ" src="…" />Alice Johnson…` | `button "Alice Johnson"`                  | `button "AJ Alice Johnson"`, with an `image "AJ"` child |
| the same, with `aria-hidden="true"` on the avatar                                       | `button "Alice Johnson"`                  | `button "Alice Johnson"`                                |
| `<li><mlv-avatar initials="JD" /> John Doe</li>` (a row, not a control)                 | `listitem`: text "John Doe"               | `listitem`: `image "JD"`, then text "John Doe"          |
| the same, with `aria-hidden="true"` on the avatar                                       | `listitem`: text "John Doe"               | `listitem`: text "John Doe"                             |
| `<mlv-avatar initials="me" />` (painted "ME" by `text-transform: uppercase`)            | nothing in the tree                       | `image "ME"`                                            |
| `mlv-avatar-group` `+N` counter (`button[aria-label="+4 more members"]`)                | `button "+4 more members"`, no child      | unchanged — the counter now hides its avatar            |
| `<mlv-avatar name="Ada Lovelace" />`, `<mlv-avatar label="Profile">…`                   | `image "Ada Lovelace"`, `image "Profile"` | unchanged                                               |
| `<mlv-avatar><svg …/></mlv-avatar>` (no name, label or initials)                        | no role                                   | unchanged                                               |

And in jsdom (`avatar.spec.ts` § _MlvAvatar image state per src_):

| Sequence                                     | Before                         | After                                    |
| -------------------------------------------- | ------------------------------ | ---------------------------------------- |
| `src="a.jpg"` → `error` → `src="b.jpg"`      | initials, no `<img>`           | skeleton + `<img src="b.jpg">`           |
| `src="a.jpg"` → `load` → `src="b.jpg"`       | `<img src="b.jpg">` `--loaded` | skeleton + `<img src="b.jpg">`, unloaded |
| `src="a.jpg"` → `error` → `null` → `"a.jpg"` | initials                       | skeleton + `<img src="a.jpg">` (retried) |
| `src="a.jpg"` → `error`, `src` unchanged     | initials                       | initials                                 |

## 2. Who is affected, and what to do

Only avatars with an explicit `initials` and no `name` or `label` see the name
change (derived initials come from `name`, which already named the avatar).
Every avatar with a `name` or a `label` renders exactly the ARIA it did.

**(a) An initials avatar beside visible text that already says who it is,
inside a control or not.** Inside a button, link, option, menu item, tab or
cell whose visible text is the person's name, the control's accessible name is
computed from its content, so it now starts with the initials ("AJ Alice
Johnson"). Outside a control — a list row, a chat bubble, a card, a timeline
entry — nothing is renamed, but the avatar is a separate `image "JD"` reading
stop before "John Doe" (measured in both engines, table above).
**Do:** mark the avatar decorative with `aria-hidden="true"` on
`<mlv-avatar>`. Where the avatar stands alone as the only identification, give
it a `name` (or `label`) instead, which reads better than initials.

**(b) Specs asserting the old ARIA** — `role` / `aria-label` absent on an
initials-only avatar, or a count of `mlv-avatar[role="img"]`, or an exact
button / link name around one.
**Do:** expect `role="img"` and `aria-label` equal to the trimmed, upper-cased
initials, and the control names from (a).

**(c) Code relying on an avatar staying on initials after an error while its
`src` changes** — for instance to avoid re-requesting known-broken URLs from a
recycled row. Each new URL is requested now. The reverse holds too: only a
changed `src` retries, so a picture re-uploaded to the URL that returned 404
(`/users/42/avatar.jpg`) stays on initials while the string is the same.
**Do:** bind `src` to `null` for a URL you know is broken; after a re-upload to
the same URL, change `src` with a cache-buster (`/users/42/avatar.jpg?v=2`).
Binding `null` and then the same URL re-renders the `<img>` too, but whether
the browser requests it again is up to its cache.

**(d) An avatar whose `src` changes after an image loaded** — a photo update,
or a recycled virtual-scroll row handed another person. Before, the new URL
inherited `--loaded`: measured on a slow second URL, Chromium 145 blanked the
image at once (`naturalWidth` 0 while loading) and then showed the new one at
full opacity with no fade, and Firefox 146 kept painting the previous image
until the new one arrived — so a recycled row showed the previous person. Now
both engines show the skeleton and then fade the new image in over
`--mlv-duration-normal` (200 ms; instant under reduced motion), as `src`
documents. Row 117.
**Do:** nothing; update visual-regression baselines that captured the old
frame.

## 3. In the repository

- `mlv-avatar-group`'s `+N` counter avatar is now `aria-hidden="true"`: the
  counter button's own `aria-label` names the overflow, and without the hide
  both engines exposed an `image "+4"` beneath it.
- Docs `/button` example 7 marks its leading avatar `aria-hidden="true"`, so
  the button still reads "Alice Johnson".
- Docs `/page` example 3's version-history authors (`[initials]="version.author"`
  in timeline meta) are now named "ME" / "DS" where they were absent — intended.
- No other `mlv-avatar` in `libs/` or `apps/` sets initials without a `name` or
  `label`.

## 4. Not changed

- `deriveInitials`, the colour pair, sizes, shapes, the label row and every BEM
  class.
- The icon-only avatar (projected content, no `name` / `label` / `initials`)
  stays role-less; its content is not hidden and speaks for itself.
- Whitespace-only `initials` with nothing else still renders no role.
