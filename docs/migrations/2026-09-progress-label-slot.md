# 2026-09 — `mlv-progress` renders its label in both shapes and is named by it

Applies to `@malva-ui/core/progress` (`MlvProgress`, `mlv-progress`). Fixes
#258, including its audit follow-up (B44 / C041, WCAG 2.5.3).

**Breaking, behaviour only.** No exported symbol was renamed or removed; the
selector, every input (`value`, `shape`, `size`, `tone`, `showPercentage`,
`ariaLabel`), the types, the i18n key and every BEM class are unchanged. What
moves is where projected content renders and which attribute names the
progressbar. A consumer that projects nothing into `mlv-progress` edits nothing
and sees nothing change.

## 1. What changed

Two defects, fixed together because the second only shows once the first is
gone.

**The default shape dropped projected content.** The template declared a bare
`<ng-content />` in each `shape` branch. Angular emits one `'*'` projection slot
per `<ng-content>` and gives every node no named slot claims to the **last**
`'*'` in the list, so the `circle` branch owned the content and the `bar`
branch — the default — rendered an empty label for the instance's whole life.
The documented label slot worked only on `shape="circle"`. A full axe sweep
passed over it: content that is not there violates no rule.

**The label never named the progressbar.** The host always carried
`aria-label` (the consumer's `ariaLabel`, else the i18n "Progress") and never
pointed at the label. A circle showing "Uploading" was announced as "Progress" —
a WCAG 2.5.3 (label in name) failure, and the same would have held for the bar
the moment its label rendered.

Now the template authors **one** `<ng-content />`, outside the `shape` branch,
so both shapes render it and a `shape` flip never moves or re-creates the
projected nodes. The wrapper gains an id and **keeps** `aria-hidden`, and the
host emits exactly one naming attribute:

| `ariaLabel` | Projected label has text | Host carries                               |
| ----------- | ------------------------ | ------------------------------------------ |
| set         | any                      | `aria-label="{ariaLabel}"` (as before)     |
| unset       | yes                      | `aria-labelledby="mlv-progress-label-<n>"` |
| unset       | no                       | `aria-label="Progress"` (as before)        |

"Has text" is the wrapper's trimmed `textContent`: whitespace-only projection
and the comment anchors an `@if` leaves count as empty, and the attribute
follows the text as it appears and disappears — on the server too, so the
pre-hydration document already carries it. Text inside an `aria-hidden`
descendant counts too (`<span aria-hidden="true">40%</span>` names the host
"40%"), because accessible-name computation reads it as well — see below.

**The wrapper stays hidden, and still names the host.** A hidden node that
`aria-labelledby` references directly contributes its text, hidden
descendants included (accname step 2A), and axe's `aria-progressbar-name`
accepts it. Hiding it is what keeps that text from being exposed a second
time: measured in Chrome 153's accessibility tree, a visible wrapper adds a
separate, non-ignored text node under the progressbar in both naming paths —
the label again beside its own `aria-labelledby` name, or a stray "CPU" beside
`aria-label="CPU usage"`. The audit comment on #258 asked to stop hiding the
label, on the premise that a hidden label cannot name the host; that premise is
false, and its requirement — the visible label names the progressbar — is met
with the wrapper hidden.

**An explicit `ariaLabel` still wins.** That is the library's rule for a label
generated from DOM text, not accessible-name order — `progressbar` takes its
name from the author only, and accname would rank `aria-labelledby` above
`aria-label` if both were emitted, which is why only one ever is. `mlv-drawer`
and `mlv-dialog` drop their header-title `aria-labelledby` for an explicit
`ariaLabel` the same way. It is also the only way to give a name richer than
the visible text, which the docs use: `ariaLabel="CPU usage"` around a visible
"CPU".

## 2. Before / after

| Call site                                              | Before                                   | After                                                       |
| ------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------- |
| No content (either shape, with or without `ariaLabel`) | name `ariaLabel` / "Progress"            | **unchanged**                                               |
| `shape="bar"` (default) + content, no `ariaLabel`      | label **not rendered**; name "Progress"  | label renders below the track; name = the label text        |
| `shape="bar"` + content + `ariaLabel`                  | label **not rendered**; name `ariaLabel` | label renders below the track; name `ariaLabel` (unchanged) |
| `shape="circle"` + content, no `ariaLabel`             | label rendered; name "Progress"          | label rendered; name = the label text                       |
| `shape="circle"` + content + `ariaLabel`               | label rendered; name `ariaLabel`         | **unchanged**                                               |
| `.mlv-progress__label`                                 | `aria-hidden="true"`, no `id`            | `aria-hidden="true"`, `id="mlv-progress-label-<n>"`         |

The label renders in the same DOM position as before — the host's last child,
after the track or the ring — and keeps its `:empty { display: none }` rule, so
a bar with nothing projected lays out exactly as before.

## 3. Who is affected

- **You project content into a bar.** It now shows, one `--mlv-font-size-xs`
  line below the track. That is the documented behaviour the bar never had. If
  the text was a leftover, delete it; if the extra line breaks a fixed-height
  layout, make room for it.
- **You project content and set no `ariaLabel`.** The progressbar is now named
  by that text instead of "Progress". Nothing to do unless you want a different
  name — then set `ariaLabel`, and keep the visible text inside it
  (`ariaLabel="Storage usage"` around "Storage"), which WCAG 2.5.3 asks for.
- **You project content and set an `ariaLabel` that does not contain it.** The
  name is unchanged, but on a bar the text is now visible, so the mismatch is
  now a 2.5.3 failure you can see. Drop the `ariaLabel` to let the label name
  the bar, or reword it to contain the label.
- **Specs.** A spec asserting `aria-label="Progress"` on a progress with
  projected text now fails. Assert the name instead: `aria-labelledby` resolves
  to the label's text, and `aria-label` is absent while it does.

Not affected: every `mlv-progress` that projects nothing, which includes every
one inside `libs/` (`mlv-chat`, `@malva-ui/editor`). In `apps/docs`, progress
example 4 is a bar whose "Installing packages…" label never rendered next to
an unrelated `ariaLabel="Installation progress"`; it drops the `ariaLabel`, so
the label now shows and names the bar. Examples 6 and 7 project a label beside
an `ariaLabel` that contains it and keep their names.

## 4. What a consumer changes

Usually nothing. The mechanical edits, by case:

```html
<!-- Bar label you want to show and to name the progressbar: drop ariaLabel. -->
<mlv-progress [value]="v">Installing packages…</mlv-progress>

<!-- A richer name than the visible text: keep ariaLabel, containing it. -->
<mlv-progress shape="circle" [value]="v" ariaLabel="Storage usage">Storage</mlv-progress>
```

```ts
// Spec: assert the name, not the attribute that used to carry it.
const id = progress.getAttribute('aria-labelledby')!;
expect(document.getElementById(id)?.textContent?.trim()).toBe('Uploading');
expect(progress.hasAttribute('aria-label')).toBe(false);
```
