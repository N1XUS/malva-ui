# 2026-09 — plurals, dates and chat times format in the active language pack's locale

**Packages:** `@malva-ui/i18n`, `@malva-ui/core/date`, `@malva-ui/core/chat`. Fixes #306 (audit B16: H-03, PICKERS-19, DD-10). Owner ruling **D3**: one `MLV_LOCALE` signal — the active language pack's locale, falling back to `LOCALE_ID` — read by plural and date formatting.

**Kind:** breaking, **behaviour and default value**. Nothing is renamed, removed or retyped. Additive: the `MLV_LOCALE` token and an optional `MlvLanguage.locale` field. Changed: what `MLV_DATE_LOCALE` defaults to, which locale `MlvNativeDateAdapter` reports after a language switch, which locale ICU plurals and `mlv-chat` times use, `mlvTranslate`'s purity, and that `MlvI18nResolverService` now needs an injection context to construct.

`VERSIONING.md` § 3: _"Changed **default value** …"_ and _"Changed **default behaviour** at an unchanged API — … what a value means"_ — major. On the `0.x` line that is a `!` commit.

---

## 1. What changes

| Surface                              | Before                                                                                    | After                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `MlvI18nResolverService.resolve()`   | `new IntlMessageFormat(template)` — the **runtime's** default locale (browser / Node ICU) | compiled in `MLV_LOCALE()`; cache keyed by locale + template; re-resolves on a pack switch                                                   |
| `new MlvI18nResolverService()`       | worked anywhere — the class injected nothing                                              | injects `MLV_LOCALE`, so outside an injection context it throws **NG0203** (§ 7)                                                             |
| `mlvTranslate` pipe                  | pure; same locale defect as the resolver                                                  | `pure: false` with its own memo (template, params identity, locale)                                                                          |
| `MLV_DATE_LOCALE` default            | `navigator.language`, then `'en-US'`                                                      | `MLV_LOCALE` at first injection: active pack's `locale` → `LOCALE_ID`. Never `navigator.language`                                            |
| `MlvNativeDateAdapter.locale`        | `MLV_DATE_LOCALE`, fixed at construction                                                  | **follows** `MLV_LOCALE` unless **pinned** (§ 5): a provided `MLV_DATE_LOCALE`, whatever its value, or a `setLocale()` that differs, pins it |
| `mlv-chat` article `aria-label` time | `formatDate(…, 'shortTime', 'en-US')` — always US English, runtime time zone              | same string as the visible time: `MLV_LOCALE`, `DatePipe`'s time zone                                                                        |
| `mlv-chat-message` visible time      | `DatePipe` `'shortTime'` in `LOCALE_ID`, `DatePipe`'s time zone                           | `Intl.DateTimeFormat` `timeStyle: 'short'` in `MLV_LOCALE`, `DatePipe`'s time zone (§ 6)                                                     |
| `mlv-chat` default date separator    | `DatePipe` `'mediumDate'` in `LOCALE_ID`, `DatePipe`'s time zone                          | `Intl.DateTimeFormat` `dateStyle: 'medium'` in `MLV_LOCALE`, `DatePipe`'s time zone (§ 6)                                                    |
| Shipped packs                        | no locale                                                                                 | `locale` first key; the directory code, except `pt` → **`pt-PT`**                                                                            |

## 2. `MLV_LOCALE`

```ts
import { MLV_LOCALE } from '@malva-ui/i18n';

private readonly _locale = inject(MLV_LOCALE); // Signal<string>
```

- `InjectionToken<Signal<string>>`, `providedIn: 'root'`.
- Value: active pack's `locale` → `LOCALE_ID` while no pack is loaded, when the pack declares none, or without `provideMlvI18n()`.
- A signal: `MlvI18nService.switchLanguage()` moves it.
- Always a canonical BCP 47 tag (`Intl.getCanonicalLocales`): `zh-hans` → `zh-Hans`; `_` reads as `-`, the way Angular reads `LOCALE_ID` (`de_AT` → `de-AT`). A pack locale still malformed after that falls back to `LOCALE_ID`, a malformed `LOCALE_ID` to `en-US`. Measured: `new IntlMessageFormat(t, 'de_AT')`, `'not a locale'` and `''` all throw `RangeError: Incorrect locale information provided` at construction, and so does `Intl.DateTimeFormat` — one typo in a pack would otherwise break every plural and date. `LOCALE_ID` needs it too: Angular accepts `de_AT` there, and before this change nothing handed `LOCALE_ID` to `Intl`. A `MLV_LOCALE` you provide yourself is used as given.
- Never reads a browser global, so a server render and its hydration format alike. Before, Node 21+ exposes `navigator.language` too (the server's ICU default), so the old `MLV_DATE_LOCALE` default silently resolved to the **server's** locale during SSR and to the **browser's** on the client.
- Overriding it is supported at environment level only: `{ provide: MLV_LOCALE, useValue: signal('de-CH').asReadonly() }` in the application providers. The resolver and the native adapter are root-provided and resolve it there; a component-level provider reaches neither.

## 3. Plurals

The resolver compiled every template with no locale, so `intl-messageformat` picked plural categories from the runtime default — the browser language, not the pack's. Measured before the fix:

| Pack | Runtime | Input | Rendered     | Correct      | Why                                                |
| ---- | ------- | ----- | ------------ | ------------ | -------------------------------------------------- |
| `uk` | `en-US` | 3     | "3 учасника" | "3 учасники" | `en` puts 3 in `other`; the `few` branch never ran |
| `en` | `uk`    | 21    | "21 member"  | "21 members" | `uk` puts 21 in `one`                              |
| `pl` | `en-US` | 5     | "5 członka"  | "5 członków" | `en` has no `many`                                 |

The ticket's _"the pack's own locale"_ did not exist: `MlvLanguage` carried no locale. Every shipped pack now declares one, and `MlvLanguage.locale` is **optional** so a hand-written pack still compiles — it formats in `LOCALE_ID`.

**`pt` is `pt-PT`, not `pt`.** The pack is European Portuguese ("ficheiro", not Brazilian "arquivo"), and the region changes formatting: CLDR `pt` puts 0 in `one`, `pt-PT` in `other`. A `pt` app whose runtime was Brazilian saw "0 ficheiro"; it now sees "0 ficheiros".

## 4. `mlvTranslate` is impure

A pure pipe re-runs only when an argument changes, and a template's `{ count: n() }` literal keeps its identity while `n()` holds. So a pack switch — which changes neither argument — left the previous language's plural category on screen even once the resolver was fixed. The pipe now runs on every refresh of its view, reads `MLV_LOCALE` (which also keeps the view subscribed), and returns its memoised string unless the template, the parameters object or the locale changed. No output changes for an unchanged locale; the cost is one comparison per refresh.

## 5. Dates

`MLV_DATE_LOCALE` is a `string` token and stays one, so it cannot follow a switch itself; its default is `MLV_LOCALE` as it stood when the token was first injected. `MlvNativeDateAdapter.locale` is now a `linkedSignal` over `MLV_LOCALE`, and the adapter is in one of two states — held as state, never inferred by comparing values:

- **Following.** `MLV_DATE_LOCALE` was **not** provided. The adapter reports `MLV_LOCALE` and takes over every switch — also when the default was read before the pack loaded. Calendars, pickers and the scheduler re-label on `switchLanguage()`: their labels are `computed()`s over the adapter.
- **Pinned.** `MLV_DATE_LOCALE` was provided — directly or through `provideMlvDateAdapter(A, locale)`, **with any value, including the pack's current locale** — or `setLocale()` was called with a value that differs from `MLV_LOCALE`. The adapter keeps that locale across **every** switch, including one that passes through it. `setLocale()` with the current `MLV_LOCALE` value returns it to following.
- How "provided" is told apart: the token's default factory records what it resolved, and a provided token never runs it. **Residual:** a `MLV_DATE_LOCALE` provided in a **child** injector (a lazy route, a component) with exactly the value the root default already resolved for another consumer reads as defaulted, and follows. Provide it where the adapter is provided — normally the application root, which `provideMlvDateAdapter()` is built for.
- Custom `MlvDateAdapter` subclasses are untouched: the base class still holds `signal('en-US')` + `setLocale()`. Read `MLV_LOCALE` in your adapter to follow the pack.

An earlier draft of this change inferred the pin by comparing the adapter's value with `MLV_LOCALE`. Review found two ways it lost a pin, both now specs that fail on that draft: an explicit `'de'` in a `de` app read as "in step" and followed the next switch; and any pin — explicit or `setLocale()` — was released by a switch that passed through it (`de` pinned, switch to `de`, switch to `uk` → `uk`), provided something read `locale()` in between, which a rendered calendar always does.

## 6. `mlv-chat`

- The article's accessible name hard-coded `'en-US'` while the bubble showed `LOCALE_ID`: a `de` app announced "3:35 PM" under a visible "15:35". Both now go through one formatter in `MLV_LOCALE`.
- `Intl.DateTimeFormat`, not `DatePipe` / `formatDate`: Angular throws NG0701 for a locale whose data was never passed to `registerLocaleData` — a `uk` pack in an `en-US` app — and `Intl` carries every locale it knows. Its output can differ from Angular's CLDR snapshot in detail: the space before "PM" is U+202F in Angular's data and a plain space in some ICU builds.
- **The time zone is still `DatePipe`'s.** `DatePipe` read `DATE_PIPE_DEFAULT_OPTIONS.timezone`, then the deprecated `DATE_PIPE_DEFAULT_TIMEZONE`; the chat reads the same two tokens in the same order and parses the value the way Angular's `timezoneToOffset` does — a fixed offset (`'+0530'`, `'+05:30'`) or an abbreviation `Date.parse` knows (`'UTC'`, `'GMT'`, `'EST'`). `Intl`'s `timeZone` rejects offset strings, so the instant is shifted by the offset and read back in UTC (specs compare against Angular's own `formatDate(…, zone)`). That renders the same time as `DatePipe` except in one hour a year: where the configured zone's wall clock falls in the hour the **runtime** zone skips at its spring-forward transition, `DatePipe` (which shifts into the runtime zone) was an hour ahead, and the chat now shows the correct time — a New York runtime with `'+0530'` showed a message sent at 2026-03-07T20:30Z as 03:00, and now shows 02:00. Dates are unaffected, and the fall-back transition matches. A value Angular cannot parse — an IANA name such as `'Europe/Berlin'` included — falls back to the runtime zone, as it did for `DatePipe`. The accessible name now honours the zone too; before, it formatted in runtime local time under a visible time in the configured zone.
- Day grouping and the Today / Yesterday labels still compare **runtime-local** calendar days, as before.
- Labels are one `computed` over the render window, so a typing-indicator or scroll refresh re-formats nothing (before: one `formatDate` per rendered message per refresh).
- A custom `[mlvChatDateDef]` receives the raw `date` and is unaffected.

## 7. What to do

| You…                                                                | Action                                                                                                                                                                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| use `provideMlvI18n()` with a shipped pack and no `MLV_DATE_LOCALE` | nothing — plurals, dates and chat times now match the pack                                                                                                                                                                          |
| want dates in a fixed locale, whatever the pack                     | provide `MLV_DATE_LOCALE` (or `provideMlvDateAdapter(A, locale)`) at the application root — any value, the pack's current one included, pins the adapter across every switch                                                        |
| want dates to follow the pack                                       | do **not** provide `MLV_DATE_LOCALE`; a provided one pins even when it equals the pack's locale today                                                                                                                               |
| construct `MlvI18nResolverService` with `new`                       | **Do:** obtain it with `inject(MlvI18nResolverService)` (in a spec, `TestBed.inject(MlvI18nResolverService)`). `new` outside an injection context throws NG0203 because the class now injects `MLV_LOCALE`; none in this repository |
| configure a time zone for `DatePipe`                                | nothing — `mlv-chat` keeps honouring `DATE_PIPE_DEFAULT_OPTIONS.timezone` / `DATE_PIPE_DEFAULT_TIMEZONE`                                                                                                                            |
| ship a pack whose `locale` might be malformed                       | fix the tag; until then the pack formats in `LOCALE_ID` rather than throwing                                                                                                                                                        |
| relied on dates following the **browser** language                  | provide `MLV_DATE_LOCALE` from your own negotiation (never `navigator.language` in an SSR app)                                                                                                                                      |
| ship a hand-written pack                                            | add `locale: '<BCP 47 tag>'`; without it the pack formats in `LOCALE_ID`                                                                                                                                                            |
| wrote a custom `MlvDateAdapter`                                     | read `MLV_LOCALE` if it should follow the pack                                                                                                                                                                                      |
| assert chat labels or dates in tests                                | expect the pack's / `LOCALE_ID`'s locale, not `en-US` / `navigator.language`                                                                                                                                                        |
| provide `MLV_LOCALE` in a component's `providers`                   | move it to the environment providers                                                                                                                                                                                                |

## 8. Not changed

- `MlvArrayDataSource`'s sort collator still uses the host locale (`new Intl.Collator(undefined, …)`) — a separate, deliberate choice, not covered by D3.
- No i18n key, BEM class or input changes. `MlvI18nService` gains only an `@internal` `_locale` signal.
