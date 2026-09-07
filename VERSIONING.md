# Versioning and Stability Policy

The contract between Malva UI and the applications that depend on it: what may
change in a patch, a minor and a major; what counts as public API; how long a
deprecated symbol survives; and how long a superseded major is supported.

- **In force from `1.0.0`.** `0.x` releases were not covered — see §7 for what
  that line actually did.
- **Companion documents:** [`docs/RELEASING.md`](docs/RELEASING.md) (how a
  release is cut), [`SECURITY.md`](SECURITY.md) (how to report a vulnerability),
  [`CONTRIBUTING.md`](CONTRIBUTING.md) (commit format), `docs/migrations/` (what
  a breaking change requires of you).
- **This document is normative.** Where it and a release note disagree, this
  document is the promise.

---

## 1. What is versioned

All published packages share one version and are released together
(`nx.json` → `release.projectsRelationship: "fixed"`). A package therefore takes
every bump, including a major, even when nothing inside it changed.

| Package               | Contains                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| `@malva-ui/cdk`       | Headless primitives — overlay, density, data-source, accessibility, utils |
| `@malva-ui/core`      | Every component, plus `styles/malva-ui.css` and `styles/tokens.md`        |
| `@malva-ui/i18n`      | i18n service, tokens and the 14 language packs                            |
| `@malva-ui/editor`    | Tiptap editor shell                                                       |
| `@malva-ui/scheduler` | Month / week / day calendar                                               |
| `@malva-ui/tailwind`  | Tailwind v4 `theme.css` adapter                                           |

Not published, and therefore carrying no compatibility guarantee of its own:

- **`libs/styles`** — no `package.json`, no npm package. Its output reaches
  consumers only as the compiled `@malva-ui/core/styles/malva-ui.css` and the
  generated `@malva-ui/core/styles/tokens.md`. The `.scss` sources, the
  `mixins.scss` API and the Sass maps are build-time internals.
- **`apps/docs`**, `scripts/`, `.claude/` — not shipped.

---

## 2. Public API

Public API is what a consumer can reach from an installed package. Eight
surfaces qualify.

Four of them are evidenced as `0.x` breaks by the classification in §7 —
TypeScript exports (#1), the template contract (#2), `--mlv-*` custom
properties (#5) and BEM class names (#6) — and entry-point paths (#8) broke
twice more, in `2026-08-editor-package` and `2026-09-core-date`. That is the
case for covering more than symbol names: a policy written over TypeScript
symbols alone would have caught none of the CSS-surface, default-value or
behaviour-only breaks.

Injection tokens (#3), subclassing contracts (#4) and i18n keys (#7) are
covered **prospectively**. The migration index records changes to each —
`2026-09-core-date` added six abstract members to `MlvDateAdapter`, which is
exactly the §3 major this policy would now require — but §7 classifies by the
kind of change rather than by these eight surfaces, so it does not evidence
them as breaks in their own right. They are in the table because they are
reachable from an installed package, not because history forced them in.

| #   | Surface               | Public when                                                                                                                                                                       | Authority                                                  |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | TypeScript exports    | Reachable from a published entry point (`@malva-ui/core/button`, `@malva-ui/i18n/en`, …) — classes, types, interfaces, functions, constants                                       | the entry point's `index.ts` barrel                        |
| 2   | Template contract     | Component / directive `selector`, `exportAs`, `input()` / `model()` / `output()` names and types, content-projection slot selectors                                               | the decorator metadata                                     |
| 3   | Injection tokens      | An exported `InjectionToken` and the shape of the value it carries (97 today)                                                                                                     | the token declaration and its interface                    |
| 4   | Subclassing contracts | Abstract bases a consumer is documented to extend or implement — `MlvDateAdapter`, `MlvSignalFormUiControlBase`, `MlvDataSource`                                                  | the abstract member list                                   |
| 5   | CSS custom properties | Every `--mlv-*` token listed in the shipped `@malva-ui/core/styles/tokens.md`, plus every component-scoped `--mlv-<block>-*` a library `CLAUDE.md` documents as an override point | `tokens.md`; the library's `CLAUDE.md`                     |
| 6   | BEM class names       | `.mlv-<block>`, `.mlv-<block>__<element>`, `.mlv-<block>--<modifier>` emitted by a library component                                                                              | the component's host bindings and template                 |
| 7   | i18n message keys     | A key on an exported `Mlv<X>I18n` interface — consumers pass their own object to `provideMlvI18n()`                                                                               | the interface declaration                                  |
| 8   | Package metadata      | Entry-point paths in `exports`, `peerDependencies` ranges, schematic names and their option names (`ng add @malva-ui/core --theme …`)                                             | the published `package.json`, `schematics/collection.json` |

BEM class names are public **because there is nowhere to hide them**:
`ViewEncapsulation.None` is mandatory on every library component
(`.claude/rules/angular-component.md`), so a class name is the only handle a
consumer has for a style override.

### Not public API

- Anything not reachable from a published entry point — internal renderers,
  implementation helpers, files deliberately kept out of a barrel
  (`.claude/projects/best-practices.md` § Project boundaries).
- Members tagged `@internal` (393 today).
- Members prefixed `_` — `private` and `protected` alike, including
  template-facing `protected` members.
- `libs/styles` SCSS: mixins, functions, maps, partials, `$`-variables.
- DOM structure below the named BEM elements: element nesting, tag choice,
  attribute order, and any class not matching the block's own BEM prefix.
- Generated artifacts: `apps/docs`, `llms.txt` / AI docs, spec fixtures.
- Anything the docs mark **EXPERIMENTAL** (§10).

---

## 3. Bump matrix

Read the table as: _this change requires at least this bump_.

| Change                                                                                                                | Bump       |
| --------------------------------------------------------------------------------------------------------------------- | ---------- |
| **Removed or renamed** exported symbol, selector, `exportAs`, input, output, model                                    | major      |
| Removed or renamed injection token, or a required member added to the value it carries                                | major      |
| Removed or renamed `--mlv-*` token published in `tokens.md`                                                           | major      |
| Removed or renamed BEM block, element or modifier class                                                               | major      |
| Removed or renamed i18n key, or a **new required** key on an `Mlv<X>I18n` interface                                   | major      |
| Removed or renamed published entry point / `exports` path / schematic option                                          | major      |
| **Narrowed** type of an input, output, token value or exported function parameter — except a peer range, see §9       | major      |
| New **required** input, or a new abstract member on a subclassing contract (§2.4)                                     | major      |
| Changed **default value** of an input                                                                                 | major      |
| Changed **default behaviour** at an unchanged API — ordering, timing, emitted events, focus, ARIA, what a value means | major      |
| Angular **major** raised in `peerDependencies`                                                                        | major      |
| New exported symbol, entry point, component, token, `--mlv-*` token, BEM modifier, schematic option                   | minor      |
| New optional input / output / model; widened input type; new optional i18n key with a shipped default                 | minor      |
| Existing symbol marked `@deprecated` (behaviour unchanged) — see _Rows no commit type reaches_ below                  | minor      |
| Angular **minor floor** raised in `peerDependencies` (§9) — see _Rows no commit type reaches_ below                   | minor      |
| Bug fix that restores documented behaviour                                                                            | patch      |
| Performance work with no observable behaviour change                                                                  | patch      |
| Visual change within an existing token — new value for an existing `--mlv-*` token                                    | patch      |
| Internal refactor behind an unchanged public surface                                                                  | patch      |
| Documentation, tests, CI, tooling                                                                                     | no release |

Two rules that follow from the table and are easy to get wrong:

- **A rename is a removal.** Adding the new name is the minor; deleting the old
  one is the major. They are different releases (§5).
- **"Nothing was renamed" does not mean "not breaking."** A default-value or
  default-behaviour change is a major even when the diff touches no identifier.
  Precedent: `docs/migrations/2026-09-popup-fullscreen-per-open.md` — nothing
  renamed, removed or retyped; `MlvPopup.isFullscreen()` simply stopped tracking
  the viewport mid-open.

### Rows no commit type reaches

`nx.json` maps exactly one commit type to a minor: `feat`. Two rows above ask
for a minor that no natural commit type produces, so **the bump is chosen at the
release, not derived from the commits**:

| Row                             | What the commits derive            | What to do                                                                          |
| ------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| Marking a symbol deprecated     | `feat` → minor; `refactor` → patch | File it as `feat`. §5 requires this — the alias is a new name, so `feat` is honest. |
| Raising the Angular minor floor | `build` / `fix` → patch            | Cut the release with the `minor` specifier (`release.yml` → `specifier`, §11).      |

Neither is machine-enforced. §11 says which controls exist and which of them a
human has to reach for.

### Not covered by the matrix

- **Visual output at unchanged tokens.** A component may change how it composes
  tokens in a minor. Pixel-exact rendering is not versioned; the token names and
  the class names are.
- **Peer-dependency behaviour.** A change forced by Angular, the CDK, Tiptap or
  `@lucide/angular` follows _their_ semantics; Malva UI bumps for the peer range
  it declares (§9), not for what the peer did inside it.

---

## 4. Migration documents

Every change that requires a major carries a file in
[`docs/migrations/`](docs/migrations/), named `YYYY-MM-<slug>.md`, landing in the
**same pull request** as the change.

It must state:

1. Which packages and symbols it applies to.
2. Whether anything was renamed or removed — explicitly say "no exported symbol
   was renamed or removed" when that is the case.
3. Before / after, as a table, per affected call site.
4. Who is affected and who is not.
5. The mechanical edit a consumer makes.

A **behaviour-only** change gets the same file. Nothing renamed is not an
exemption — it is the case a consumer is least able to discover from a diff.
Precedent: `docs/migrations/2026-09-popup-fullscreen-per-open.md`.

The index at the top of [`CLAUDE.md`](CLAUDE.md) lists them, newest first.

---

## 5. Deprecation window

A public symbol is **never removed without a released deprecation**.

| Step | Release              | What ships                                                                                        |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------- |
| 1    | any `X.Y.0` minor    | The replacement, plus the old name kept as a **working alias** carrying a `@deprecated` JSDoc tag |
| 2    | every later `X.*`    | The alias keeps working, unchanged                                                                |
| 3    | the next `(X+1).0.0` | The alias is deleted, and `docs/migrations/` carries the entry                                    |

What a consumer is guaranteed:

- **At least one full minor** in which both names work. The alias may not be
  introduced and removed in the same major.
- **A build-time warning, not a runtime one.** `@deprecated` is surfaced by
  TypeScript and every major editor at the call site. Nothing logs at runtime,
  and nothing changes behaviour while the alias stands.
- **Named versions, and a removal that has to happen.** The tag says when the
  deprecation started and which major removes it, so the removal date is
  knowable the day the deprecation ships — and the check compares the named
  major against the root `package.json`, so the alias cannot quietly outlive it.
  The release that reaches the named major fails the build until the symbol is
  gone or the tag is honestly re-dated.
- **An entry in the release notes.** The deprecating commit is a **`feat`** and
  appears in `CHANGELOG.md` under 🚀 Features. It has to be `feat`: that is the
  only type `nx.json` maps to the minor §3 requires, and a `refactor` would
  derive a patch — anchoring the alias to a patch, so nobody could say whether
  the one-full-minor window had been honoured (§3, _Rows no commit type
  reaches_).

### Tag grammar

Every `@deprecated` tag in `libs/**` names both versions:

```ts
/**
 * @deprecated since 0.1.12 — removed in 1.0. Use `MlvDataSourceFilterOperator`
 * from `@malva-ui/cdk/data-source` instead.
 */
```

- `since <version>` — where the deprecation shipped. `major.minor` is the
  granularity the guarantee above is written in, so it is the granularity the
  tag needs. **In a `0.x` line, name the patch too**: every release the library
  has ever cut is `0.1.x`, so a bare `since 0.1` identifies nothing. The two
  tags in the tree say `0.1.10` and `0.1.12` for that reason.
- `removed in <version>` — the major that deletes it. Must be a major boundary
  (`1.0`, `2.0`, `2.0.0`); removal in a minor or patch is not permitted by §3.
  It must also still be **ahead of the released line** — a tag reading
  `removed in 1.0` is a broken promise the day `1.0.0` ships with the symbol
  still present, and the check fails on it rather than staying green forever.
- Order is free and the separator is free; both phrases must be present.
- The tag is spelled `@deprecated`, lowercase. TypeScript recognises no other
  casing, so `@DEPRECATED` is prose: it strikes nothing through at a call site
  and delivers none of the build-time warning promised above. The check finds it
  case-insensitively and rejects anything but the canonical spelling.
- A `since` or `removed in` belonging to a **neighbouring** tag does not count.
  TypeScript ends a tag at any `@`-tag preceded by whitespace, mid-line
  included, and the check reads the text the same way it does.

Enforced by `node scripts/check-deprecations.mjs`, wired to
`yarn nx run @malva-ui/source:check-deprecations` and run as a dependency of the
root `test` target that CI selects. It scans every `.ts`, `.scss` and `.css`
file under `libs/` — the global stylesheet and `@malva-ui/tailwind` included,
because a `--mlv-*` token and a BEM class are public API here (§2) and get
deprecated in CSS. Any of the five rules above failing fails the build.

### When there is no alias

A rename with no possible alias — a BEM class name, a `--mlv-*` token, a changed
default — cannot carry a deprecation. Those go straight to a major, with the
migration document as the only notice. The document must say so.

### When there is no successor

A symbol may be deprecated with **nothing to move to**: it does not do anything,
and the replacement is to stop passing it. `MlvBadge.rounded` is the one in the
tree — a no-op input kept only so existing `[rounded]` bindings keep compiling.

The window above applies unchanged; only the advice differs. The tag says there
is no replacement and what to do instead (for `rounded`, override
`border-radius` on `.mlv-badge`), and the migration document at the removing
major says the same. Deleting a no-op is still a §3 major: the binding stops
compiling, which is a break whether or not the input ever did anything.

---

## 6. Prereleases

- Version form: `X.Y.Z-rc.N`.
- Carries **no** guarantee from this document. API may change between two
  prereleases of the same version.
- Published under the `next` dist-tag, so `latest` keeps pointing at the stable
  line.
- A major is published as at least one prerelease before it takes `latest`.

**Not yet mechanised.** The last two bullets are release procedure, not
something `release.yml` enforces. `specifier` and `distTag` are independent
inputs, `distTag` defaults to `latest`, and `scripts/publish.mjs` is handed
`--tag ${{ inputs.distTag }}` with no cross-check against the version it is
publishing — so `specifier: prerelease` left at the default `distTag` puts
`2.0.0-rc.1` on `latest`, and nothing in the workflow objects.

Until the workflow refuses that pairing, whoever starts the run is the check:
**a prerelease specifier takes `distTag: next`, every time.**

---

## 7. Pre-1.0: what actually happened

`0.x` made no compatibility promise, and the history shows it. Stated here
because it is the gap this policy closes, not because it is defensible.

| Fact                                                                                                   | Evidence                                                                          |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Breaking changes shipped in **patch** releases                                                         | `CHANGELOG.md:1,27,29` (0.1.15), `:389,410` (0.1.5)                               |
| The `0.1.0` release alone carried four breaking changes                                                | `CHANGELOG.md:690-693,742`                                                        |
| No deprecation alias was kept across a rename                                                          | `.claude/projects/libs-expand.md:10` — "No deprecated alias is kept"              |
| Only two `@deprecated` tags exist in the whole library                                                 | `libs/core/badge/src/lib/badge/badge.ts`, `libs/core/data-table/src/lib/types.ts` |
| Breaks reached consumers as more than renamed symbols — through types, defaults, behaviour and CSS too | table below                                                                       |

**How a breaking change reached a patch release.** Not through the commit
convention, which got it right: Nx short-circuits to MAJOR for any commit
carrying `!` or a `BREAKING CHANGE:` footer, before it consults the type map at
all (`nx/…/release/utils/semver.js:41`). `adjustSemverBumpsForZeroMajorVersion`
then demotes that MAJOR to a minor on a `0.x` line
(`…/utils/semver.js:69-86`, enabled at `…/release/config/config.js:245`), so
the `refactor!` in 0.1.14 **derived 0.2.0**.

It released as 0.1.15 because the release was cut with the bump forced. The
`specifier` input on `release.yml:9-13` is a free choice of
`auto | patch | minor | major | prerelease`, and anything but `auto` is passed
straight to `nx release`, overriding whatever the commits derived. That input is
not a `0.x` artifact and **survives `1.0.0` untouched** — see §11.

The nineteen logged migrations (`CLAUDE.md:31-49`), classified by the **kind of
break**, not by the eight surfaces in §2. A migration that broke in more than one
way is counted in each row, so the column sums past nineteen —
`2026-08-scrollbar-viewport-tabindex` alone removed a mechanism, narrowed a type
**and** changed a default.

| Kind                                   | Count | Examples                                                                                                                                                                                                                                         |
| -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rename / move of an exported symbol    | 6     | `2026-07-mlv-prefix` (every public class), `2026-07-api-unification-tone-size`, `2026-09-core-date`, `2026-08-editor-package`, `2026-08-options-data-source`, `2026-07-toast-shape-icon-announcement`                                            |
| Removal of a public member             | 4     | `2026-08-dialog-composition` (`*mlvDialogHeaderDef`, `showCloseButton`, `mlvDialogContent`), `2026-08-scrollbar-viewport-tabindex`, `2026-08-form-field-surface`, `2026-07-toast-shape-icon-announcement`                                        |
| Type narrowing                         | 1     | `2026-08-scrollbar-viewport-tabindex` — `number` → `-1 \| 0 \| null`                                                                                                                                                                             |
| Default-value change                   | 2     | `2026-08-scrollbar-viewport-tabindex` (`0` → `null`), `2026-08-button-icon-only-default-variant` (`primary` → `secondary`)                                                                                                                       |
| Behaviour-only, nothing renamed        | 2     | `2026-09-popup-fullscreen-per-open`, `2026-09-data-source-sort-semantics`                                                                                                                                                                        |
| CSS surface — BEM class or `--mlv-*`   | 3     | `2026-09-scrubber-extraction` (`.mlv-time-picker-column*` → `.mlv-scrubber*`), `2026-08-sidebar-state-tokens`, `2026-08-visual-harmonization`                                                                                                    |
| Additive with a required consumer edit | 5     | `2026-09-drawer-header` (consumers rendering their own close button now render two), `2026-08-form-field-surface`, `2026-08-overlay-chrome-and-focus`, `2026-08-page-dock-floating-and-toast-inset`, `2026-08-sidebar-responsive-and-row-rhythm` |

The index records exactly one of the nineteen keeping a working alias across a
rename — `2026-08-options-data-source` left `MlvDataTableFilterOperator` as a
`@deprecated` alias of `MlvDataSourceFilterOperator`, and that alias is still in
the tree. It cannot be shown to be the _only_ one: seventeen of the nineteen
documents are gone (below), and the history was squashed, so
`git log -S'MlvDataTableFilterOperator'` reaches nothing earlier than the root
commit. The index summaries are the evidence, and they name one. §5 makes it the
rule rather than the exception.

Only **two** of those nineteen files are present on `main`
(`docs/migrations/2026-08-visual-harmonization.md`,
`docs/migrations/2026-09-drawer-header.md`); the other seventeen links in
`CLAUDE.md` are dead. The summaries in that index are the surviving record.

### What changes at 1.0.0

| Before (`0.x`)                                                                                       | From `1.0.0`                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A `!` commit **derived** a minor — Nx demoted its MAJOR under `adjustSemverBumpsForZeroMajorVersion` | A `!` commit derives a **major**; the demotion only applies while the major is `0`                           |
| Breaking changes reached `latest` with no prior release under the old name                           | One minor with a working alias first (§5)                                                                    |
| A rename could ship with no migration document present in the tree                                   | The migration document lands in the same pull request (§4)                                                   |
| Only the newest release was supported                                                                | The previous major has a stated support window (§8)                                                          |
| CSS surfaces changed without a bump that said so                                                     | Token and BEM renames are majors (§3)                                                                        |
| A forced `specifier` could publish a derived major as a patch, and did                               | **Unchanged — the input survives 1.0.0.** Nothing in the release path refuses it; §11 says who the check is. |

---

## 8. Support window

| Line                           | Receives                                                                            | For                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Current major, latest minor    | Everything — features, fixes, security                                              | Always                                                |
| Current major, earlier minors  | Nothing. Upgrade to the latest minor of the major; it is compatible by §3.          | —                                                     |
| Previous major, latest minor   | **Security fixes** and **correctness regressions introduced by the major boundary** | **6 months** from the day the new major took `latest` |
| Previous major, earlier minors | Nothing                                                                             | —                                                     |
| Two or more majors back        | Nothing                                                                             | —                                                     |

- "Security fix" is scoped by [`SECURITY.md`](SECURITY.md) § Scope.
- Backports are patch releases on the previous major's line. No features, no new
  Angular majors, no new components.
- A CVE in a peer dependency is not backported — raise the peer yourself; the
  declared range (§9) admits it.
- Reaching end of support is announced in the release notes of the major that
  starts the clock.

**Not yet mechanised.** The window above needs two things that do not exist at
the time of writing, both of them the maintainer's call at the `1.0.0` cut:

1. A `release/N.x` maintenance branch. `release.yml` runs on `main` only.
2. A dist-tag for the maintenance line. `release.yml`'s `distTag` input is a
   fixed choice of `latest | next`; a `v{N}-lts` option has to be added before a
   backport can be published without moving `latest`.

Until both exist, the previous-major row of the table is a stated intent with no
delivery mechanism — treat it as unsupported.

---

## 9. Angular and peer dependencies

The workspace pins Angular exactly for reproducible builds
(`package.json` → `@angular/core: 22.0.7`). `scripts/publish.mjs`
(`widenPeerRange`) widens each exact pin into `^<major>.<minor>.0` in the
published `peerDependencies` — `22.0.7` → `^22.0.0`, `3.29.2` → `^3.29.0`.
Ranges the root already expresses (`^1.25.0`, `~7.8.0`) pass through untouched,
and `@malva-ui/*` siblings stay exact because they release together.

| Change in the workspace pin         | Published range       | Malva bump | Consumer effect                                                                     |
| ----------------------------------- | --------------------- | ---------- | ----------------------------------------------------------------------------------- |
| Angular patch (`22.0.7` → `22.0.9`) | unchanged (`^22.0.0`) | none       | none                                                                                |
| Angular minor (`22.0.7` → `22.1.2`) | `^22.0.0` → `^22.1.0` | **minor**  | Raises the floor. A consumer on Angular `22.0.x` stays on the previous Malva minor. |
| Angular major (`22.x` → `23.0.0`)   | `^22.0.0` → `^23.0.0` | **major**  | Angular major and Malva major are upgraded together.                                |

- Malva UI supports **one Angular major at a time**. There is no dual-major
  range.
- The same rules apply to `@angular/cdk`, `@angular/aria`, `@angular/forms`,
  `@lucide/angular`, `rxjs` and the twelve `@tiptap/*` peers of
  `@malva-ui/editor`.
- `@malva-ui/tailwind` declares `tailwindcss: ^4.0.0` by hand; raising that major
  is a Malva major.

### Why the floor raise is a minor and not a major

It is a **narrowing**, and §3 majors a narrowing. `^22.0.0` → `^22.1.0` admits
strictly fewer versions, `peerDependencies` ranges are public API (§2 #8), and
the failure is worse than the typecheck failures §3 majors: npm reports an
unsatisfiable peer as **`ERESOLVE`**, an install that stops, not a warning. A
consumer on Angular `22.0.9` with `"@malva-ui/core": "^1.2.0"` resolves `1.3.0`
and their install fails.

It is a minor anyway, and this is the exception §3's narrowing row points at:

- **Angular's own minors are non-breaking**, so the consumer's remedy is to
  upgrade Angular within the major they are already on — a cheap, in-major move,
  not the migration a Malva major asks for.
- **The alternative is worse.** Malva supports one Angular major at a time, and
  Angular ships a minor every few weeks. Majoring on each floor raise would burn
  majors at Angular's minor cadence, which would make §5's one-minor deprecation
  window and §8's six-month support window meaningless.

So this is a documented case where **a minor can fail an install**. Two things
follow, and they are the price of the exception:

- **The floor is raised only when the library genuinely requires the newer
  Angular** — never as a side effect of a routine workspace bump. A pin moved
  for convenience gets pinned back before release.
- **The release notes name the new floor**, so a consumer can see it before
  upgrading.

If you are pinned to an Angular minor you cannot move off, pin Malva to the
minor as well — `~1.2.0` rather than `^1.2.0` — and take patches only. That is
the supported way to sit on an old Angular minor; §12 is not, because a floor
raise announced in the release notes is intended behaviour, not a regression.

---

## 10. Experimental API

Something published before its shape is settled is marked **EXPERIMENTAL** in
the owning library's `CLAUDE.md`, on the first screen, with the reason.

Precedent: `.claude/projects/libs-shrink-wrap.md:5` —
"⚠️ **EXPERIMENTAL — no adoptions.**"

Guarantee: **none.** An experimental surface may be renamed, retyped,
redesigned or deleted in any release, including a patch. §3, §4 and §5 do not
apply to it. Depend on it only if you are prepared to follow it.

Leaving experimental status is a **minor**, at which point every clause above
starts to apply.

---

## 11. How the machinery enforces this

| Clause                                                                                                       | Mechanism                                                                                                                   | Runs                    |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Commit type → bump                                                                                           | `nx.json` → `release.conventionalCommits.types`; the format is enforced on the `commit-msg` hook by `commitlint.config.mjs` | every commit            |
| A breaking change is declared                                                                                | `!` on the type, or a `BREAKING CHANGE:` footer. Both route the commit into the `⚠️ Breaking Changes` changelog section     | every commit            |
| `@deprecated` names both versions, is still ahead of the released line, and is spelled so TypeScript sees it | `scripts/check-deprecations.mjs` → `@malva-ui/source:check-deprecations`, a `dependsOn` of the root `test` target           | CI, every PR and push   |
| Every published `exports` target resolves                                                                    | `scripts/dist-exports.mjs`, preflighted by `scripts/publish.mjs` before any tarball is pushed                               | every publish           |
| Releases are deliberate                                                                                      | `release.yml` is `workflow_dispatch` only, defaults to `dryRun: true`. A push to `main` never publishes                     | every release           |
| Documented API matches the code                                                                              | `scripts/check-doc-api.mjs` → `yarn nx run docs:check-doc-api`                                                              | **by hand — see below** |

**Types that never bump the version on their own** — `chore`, `test`, `ci`,
`style` and `docs`. Of those, only the first four are also hidden from the
changelog (`changelog: false` in `nx.json`); `docs` has a visible
📖 Documentation section and renders in `CHANGELOG.md` like any other type.

A breaking change still may not be filed under any of them, but not because the
version would stand still — it would not. Nx checks `commit.isBreaking` **before**
it consults the type map (`nx/…/release/utils/semver.js:41`), so `chore!:` bumps
exactly as `feat!:` does. What it loses is the announcement: for the four hidden
types the commit takes its `BREAKING CHANGE:` footer down with it, and the
release ships a version bump with an empty ⚠️ Breaking Changes section and
nothing in the changelog that says why.

**This workspace ships breaking changes as `refactor!`.** That is why `refactor`
is mapped explicitly in `nx.json` rather than left to Nx's defaults, which hide
it.

### What the machinery does not enforce

Three gaps sit between what this document promises and what the pipeline
delivers: one control that can override the table above, and two clauses with no
job behind them at all. They are listed here rather than as rows in the table,
because a row that names a mechanism nobody runs reads as a guarantee and is not
one.

1. **The derived bump can be overridden at the release.** `release.yml`'s
   `specifier` input takes `patch | minor | major | prerelease` and hands it
   straight to `nx release`, replacing whatever the commits derived. This is how
   0.x published derived majors as patches (§7), and it is unchanged at `1.0.0`.
   It is also the only way to reach the two rows in §3 that no commit type
   produces, so it cannot simply be removed — **leave it on `auto` unless §3
   asks for a bump the commits cannot derive.**
2. **`docs:check-doc-api` is not wired into CI.** No workflow selects it and no
   target `dependsOn` it; it is a checkbox on the pull-request template
   (`.github/PULL_REQUEST_TEMPLATE.md:13`) and a command you run. It also exits
   `0` on its 241 standing warnings — only a documented member that is _absent_
   from the extracted API fails it, and only `--strict` fails on the warnings.
   So the `CLAUDE.md` files §2 #5 makes the authority for `--mlv-<block>-*`
   overrides can drift from the code with every gate green.
3. **The prerelease dist-tag pairing** — see §6.

§8 carries a fourth, for the support window itself.

---

## 12. Reporting a compatibility break

A change that breaks a documented surface without the bump this document
requires is a **bug**, not a new baseline.

- Open an issue titled `regression: <surface> broke in <version>`.
- Include the version you upgraded from and to, the surface (symbol, class name,
  token, i18n key), and a minimal reproduction.
- A confirmed break is fixed in a patch on the current major, or — where the new
  behaviour is the intended one — gets the migration document it should have
  shipped with (§4).

One case is **not** a regression, because this document already declares it: an
`ERESOLVE` after a minor that raised the Angular peer floor. §9 says a minor may
do that, and says what to do instead. Everything else on the eight surfaces in
§2 is in scope.
