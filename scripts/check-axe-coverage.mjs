#!/usr/bin/env node
/**
 * Malva UI — axe coverage check.
 *
 * `.claude/rules/accessibility.md` says every component must pass all AXE
 * checks. Nothing enforced that: 23 of the 93 library projects asserted with
 * axe, and among those there were five different call shapes — including
 * `runOnly` a single rule and `not.toContain` a single rule id, which read as
 * "this component is axe clean" while checking one rule out of the 94 a
 * default sweep asks (#47).
 *
 * The tightening and the shared helper (`@malva-ui/internal-testing/axe`) fix
 * the shape. This script keeps it fixed, and asks four questions:
 *
 *   1. Does every library project that renders DOM assert with axe?
 *      "Renders DOM" is derived, not declared: a project renders DOM when any
 *      non-spec `.ts` it owns declares an `@Component` or `@Directive`. A
 *      project that declares neither cannot produce a role, a name, a state or
 *      a tab stop, so there is nothing for axe to judge.
 *   2. Is every entry in the two lists below still true? A stale exemption or a
 *      stale rollout entry is a hole nobody notices, so both are re-derived on
 *      every run and a mismatch fails. A `ROLLOUT_PENDING` entry says either
 *      "nothing swept" or "these states still owed", and each is checked in the
 *      direction that can catch it out (#257) — coverage is not a boolean, and
 *      reading one from both this question and question 1 is what let a single
 *      default-state sweep retire a project permanently.
 *   3. Does every spec go through the shared helper? A direct `axe-core` import
 *      is how the five call shapes came back. Playwright suites under a
 *      project's own top-level `e2e/` are exempt from THIS question only: they
 *      inject `axe.source` into a real browser page, where the helper's jsdom
 *      assumptions and its `vitest` `expect` do not apply. An `e2e/` file never
 *      counts as coverage for question 1 — otherwise naming a directory `e2e`
 *      would both smuggle a raw jsdom sweep past this check and mark the
 *      project covered.
 *   4. Did the walk actually see anything? Every answer above is derived from
 *      files read off disk, and "no files" and "nothing wrong" are the same
 *      answer to questions 1-3. A floor is asserted before anything is reported
 *      clean: a failed directory read, a project whose non-empty `src/` yielded
 *      no TypeScript, no library projects at all, or no DOM-rendering project
 *      at all is a finding, not an OK.
 *
 * Scope. Questions 1 and 2 — coverage, `EXEMPT`, `ROLLOUT_PENDING` — are about
 * `libs/**` library projects, which is what the issue's acceptance is about;
 * `apps/docs` renders DOM too, but its pages are examples of the libraries
 * rather than the shipped surface. Question 3 is a rule about how a spec is
 * written, and `.claude/rules/accessibility.md` states it without qualification,
 * so it is checked over `apps/**` applications as well.
 *
 * Usage:
 *   node scripts/check-axe-coverage.mjs [--json] [--quiet]
 *   yarn nx run @malva-ui/source:test
 *
 * Flags:
 *   --json    Emit the full report as JSON, both lists included.
 *   --quiet   Suppress the summary line when nothing is found.
 *
 * Exit code: 0 when clean, 1 when at least one finding is reported.
 *
 * Tested by `scripts/check-axe-coverage.spec.mjs`, which pins the ways this
 * guard was made to pass with the defect present: a walk that saw no files, a
 * comment that merely mentions the helper, a directory named `e2e` below a
 * project's root, and — the inverse shape — a rollout entry that stops
 * describing its project without anything failing (#257).
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE_ROOT = resolve(import.meta.dirname, '..');
const SPEC_PATTERN = /\.(spec|test)\.[cm]?[jt]sx?$/;
/**
 * The files the walk reads. Kept in step with the `{workspaceRoot}/libs/**\/*.ts`
 * family of `inputs` on the root `test` target in `project.json`: a file this
 * matches but that glob does not would change the guard's answer without
 * invalidating its cache.
 */
const SOURCE_PATTERN = /\.[cm]?tsx?$/;
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.nx',
  '.git',
  'coverage',
  'tmp',
]);

/**
 * A declaration that puts an element, an attribute or a host binding in the DOM.
 *
 * Deliberately shape-bound: the decorator must open a line and be followed
 * immediately by `(`. That is the only form prettier emits, and prettier gates
 * every commit, so a decorator this misses (`@Component /* c *\/ ({`, an
 * indented one) cannot survive the hook. Matching loosely instead would let a
 * `@Component` inside a string or a doc comment mark a project as rendering DOM.
 */
export const RENDERS_DOM = /^@(Component|Directive)\(/m;
/**
 * The one sanctioned way a spec asserts accessibility — the specifier of a real
 * `import`, not a mention of it. Paired with {@link HELPER_CALL}: a project is
 * only covered when a spec both imports the helper AND calls it. A comment
 * saying "sweep this with @malva-ui/internal-testing/axe" is a note to a future
 * implementer, and counting it as coverage would make the guard tell them their
 * work is done and prescribe deleting the line that tracks it.
 */
export const HELPER_IMPORT =
  /\bfrom\s*['"]@malva-ui\/internal-testing\/axe['"]/;
/** A call to one of the helper's assertions. See {@link HELPER_IMPORT}. */
export const HELPER_CALL = /\b(expectNoAxeViolations|runAxe)\s*\(/;
/**
 * A real `axe-core` entry point: static import, `require`, or dynamic import.
 * Binding-shaped rather than a bare specifier match, so prose about `axe-core`
 * in a comment is not reported as one.
 */
export const RAW_AXE_IMPORT =
  /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)['"]axe-core['"]/;

/**
 * PERMANENT exemptions. A project belongs here only when nothing it emits can
 * change any axe rule's outcome: no element, no ARIA role/attribute/state, no
 * accessible name, no focusability, no tab order, no interactive semantics —
 * only classes, custom properties, geometry or plain data.
 *
 * "It is a directive" is not a reason. `[mlvClick]` is a directive and writes
 * `role` and `tabindex` onto an arbitrary host, so it is NOT exempt.
 *
 * `rendersDom` records the state the reason rests on, and is re-derived every
 * run. The drift check is **not** symmetric, and it is worth being precise
 * about which half it protects:
 *
 * - For a `rendersDom: false` entry it is load-bearing. The project starting to
 *   declare a component or directive fails here rather than staying quietly
 *   uncovered — that is the hole this catches.
 * - For a `rendersDom: true` entry it can only fire the other way, when the
 *   project stops declaring anything. The reason itself ("a class carries no
 *   role", "it writes nothing to the DOM") is prose about what the declaration
 *   emits, and no derived fact contradicts it, so such an entry can go stale
 *   silently. Those four reasons are re-read by hand when the project changes;
 *   a `hasAxe` sweep appearing is the only automatic signal.
 */
export const EXEMPT = {
  cdk: {
    rendersDom: false,
    reason:
      'Family barrel. `libs/cdk/src` is an `index.ts` re-export plus a test setup; every declaration it publishes is owned and swept by a leaf project.',
  },
  core: {
    rendersDom: false,
    reason:
      'Family barrel. `libs/core/src` is an `index.ts` re-export, an SSR smoke spec and the ng-add schematics; every component it publishes is owned and swept by a leaf project.',
  },
  'cdk-data-source': {
    rendersDom: false,
    reason:
      '`MlvDataSource` / `MlvArrayDataSource` are plain classes that sort, filter, search and page arrays. No decorator, no template, no host binding.',
  },
  'cdk-density': {
    rendersDom: true,
    reason:
      'The three `[mlvDensity="…"]` directives and `[mlvDensityRoot]` write exactly one thing: a CSS class (`mlv-<element>--<density>` via `Renderer2`, `mlv--<density>` via a host `[class]`). A class carries no role, name, state or focusability, so no axe rule can observe the difference between the directive applied and absent.',
  },
  'cdk-floating-container': {
    rendersDom: true,
    reason:
      "`[mlvFloatingContainer]` is an attribute component on the consumer's own footer/landmark element: `<ng-content />`, a BEM class and a `--mlv-floating-container-background` custom property. It contributes no element of its own and no ARIA; the gradient backdrop and safe-area padding are CSS geometry jsdom does not lay out.",
  },
  'cdk-infinite-scroll': {
    rendersDom: true,
    reason:
      '`[mlvInfiniteScroll]` declares no `host` block at all. It attaches a scroll listener and emits `loadMore`; it writes nothing to the DOM, so a sweep with it applied is byte-identical to one without.',
  },
  'cdk-shrink-wrap': {
    rendersDom: true,
    reason:
      '`<mlv-shrink-wrap>` renders one presentational `<span>` around projected content and `[mlvShrinkWrap]` sets an inline `max-inline-size`. Both are sizing; neither adds a role, a name or a tab stop. The effect itself is a CSS scroll-driven animation, which jsdom does not run.',
  },
  'cdk-testing-e2e': {
    rendersDom: false,
    reason:
      'Playwright fixtures, page objects and selector helpers. No Angular declaration, no TestBed, no `test` target — nothing here is ever rendered.',
  },
  'core-date': {
    rendersDom: false,
    reason:
      'The date-adapter contract (`MlvDateAdapter`, `MlvNativeDateAdapter`, the tokens and the provider). Component-less by design — see `docs/migrations/2026-09-core-date.md`.',
  },
  i18n: {
    rendersDom: false,
    reason:
      'Signal-based translation services, the ICU formatter and the language packs. Its one declaration is `MlvTranslatePipe`, and a pipe returns a string: it emits no element and no attribute of its own.',
  },
  styles: {
    rendersDom: false,
    reason:
      'Pure SCSS design tokens, themes and mixins. Its only `.ts` is an empty barrel; its suites are `.mjs` and assert on compiled CSS text.',
  },
  tailwind: {
    rendersDom: false,
    reason:
      'A Tailwind v4 `@theme` adapter (`theme.css`) plus schematics. It owns no TypeScript source at all.',
  },
};

/**
 * TEMPORARY. The projects that render DOM and are not yet swept to the standard
 * `.claude/rules/accessibility.md` asks for — "one sweep per state that changes
 * the markup". Phase 2 finishes each and deletes its line, so this list only
 * ever shrinks.
 *
 * It is a literal on purpose. A list computed at runtime from "which projects
 * currently lack coverage" can never fail, because it always describes exactly
 * the projects it is meant to be catching.
 *
 * Two entry shapes, because coverage is not a boolean (#257):
 *
 * - `'core-input'` — **nothing swept**. The project must assert with axe
 *   nowhere; a sweep appearing means the line no longer describes it.
 * - `{ project: 'core-x', owes: ['open panel'] }` — **partially swept**. At
 *   least one sweep exists and the named states do not have one. The project
 *   must assert with axe somewhere; an entry over a project with no sweep at
 *   all is a lie and is reported.
 *
 * The second shape exists because one `hasAxe` boolean drove both the
 * `uncovered` and the `stale-rollout` rules, so the FIRST sweep — however
 * partial — forced the line to be deleted, and this list only ever shrinks. A
 * component whose interactive surface is portaled into a CDK overlay could
 * therefore buy permanent retirement with one closed-state sweep of
 * `fixture.nativeElement`, and the rest of its states became unaskable. It also
 * ran the other way: `core-input`'s `input-native.spec.ts` says in prose that it
 * declined to add a sweep at all rather than "commit the project to full-state
 * coverage", so the coupling was suppressing partial coverage as well as
 * over-crediting it.
 *
 * Be precise about what `owes` buys, because it is easy to over-read. The guard
 * cannot see states, so it cannot check the claim: over a project with at least
 * one sweep, ANY `owes` list is accepted verbatim and forever, and a list left
 * behind after the states were swept silences that project permanently. The two
 * directions only catch the shapes that need no state knowledge — a bare entry
 * over a swept project, and an `owes` entry over a project with no sweep at all.
 * What the annotation buys is therefore not verification: the project stays on
 * the list instead of leaving it, the gap is named in the source of truth, and
 * the retirement decision gets made later in front of the evidence rather than
 * blind. A malformed entry is reported rather than quietly normalizing to
 * nothing, so the tracker cannot lose a project to a typo.
 *
 * Do not add an UNSWEPT project to this list. A project appearing here with no
 * sweep that was not here before is the regression this guard exists to block —
 * a covered project that lost its assertion, or a new project shipped without
 * one. Two moves are not that regression and are allowed:
 *
 * - converting an existing entry from the bare shape to the `owes` shape, which
 *   is the same entry saying more; and
 * - re-entering a project that already retired and is only PARTIALLY swept,
 *   which must arrive with `owes` naming what is missing. `core-autocomplete`
 *   is the worked example: #222 swept four panel states and deleted its line,
 *   and `.claude/projects/libs-autocomplete.md` recorded a fifth it did not
 *   reach. That is the same "one sweep is not full coverage" fact the `owes`
 *   shape exists for, found one commit late; refusing it would only mean the
 *   gap stays in a doc no guard reads.
 *
 * The boundary is the sweep count, not the history: a project with zero sweeps
 * may never be added, in either shape.
 *
 * @type {ReadonlyArray<string | { project: string, owes: readonly string[] }>}
 */
export const ROLLOUT_PENDING = [
  // libs/core
  {
    project: 'core-autocomplete',
    owes: [
      'the `loadingMore` next-page row (needs the paged data-source stub)',
    ],
  },
  {
    // #301 swept `mlv-color-picker-popup` in `field` presentation: writable
    // with its clear button, readonly and disabled — each NARROWED on
    // `aria-allowed-attr` (`aria-expanded` on the field's text input).
    project: 'core-color-picker',
    owes: [
      '`mlv-color-picker` itself: the saturation plane, hue / opacity sliders and mode tabs',
      'the open popup panel',
      '`presentation="icon"` and the swatch trigger',
      'error + `description` + `message`',
      'an un-narrowed `field` sweep (`aria-allowed-attr` on the text input, #426)',
    ],
  },
  {
    // #318 swept a truncated flat list, a truncated grouped list and an
    // activedescendant row rendered past the window (`scrollMode="self"`).
    project: 'core-dropdown',
    owes: [
      'the `loading` row and the `loadingMore` next-page row',
      'a `multiple` list with checked rows',
      '`highlightQuery` match marks and an `itemTemplate` row',
      '`scrollMode="parent"` inside `mlv-popup`',
    ],
  },
  'core-file-upload',
  'core-form',
  {
    // #301 swept default with a value and its clear button, readonly, disabled.
    project: 'core-input',
    owes: [
      'prefix / suffix slots and `projectControl`',
      '`bare`',
      'a `hint` inside the label',
      'error + `description` + `message`',
      'the `loading` state',
    ],
  },
  {
    // #362 swept one stack pane holding a toast and a notification with a
    // tone icon, description, one action and its dismiss button.
    project: 'core-notification',
    owes: [
      'template and component content (`open()` with a `TemplateRef` or a component)',
      '`showIcon: false` and `closable: false`',
    ],
  },
  {
    // #298 swept default, readonly, disabled and error + description + message;
    // #301 the `clearable` clear button while it holds a value.
    project: 'core-number-input',
    owes: [
      '`stack="vertical"` steppers, both `controlAlignment`s',
      'a `hint` inside the label',
      'the `loading` state',
    ],
  },
  'core-pin-input',
  {
    // #322 swept the full-screen sheet (named by its title, and by `ariaLabel`
    // alone), the anchored role-less panel and the anchored modal dialog —
    // each stamped from `popupTemplate`, not through a CDK overlay.
    project: 'core-popup',
    owes: [
      '`hasArrow` on the anchored panel',
      'the full-screen header slots (`[mlvPopupHeaderContent]`, `[mlvPopupHeaderActions]`) and `[mlvPopupPinnedContent]`',
      '`[mlvPopupTrigger]` and `mlv-popup-container` trigger hosts, closed and open through the overlay',
    ],
  },
  'core-scrollbar',
  {
    // #298 swept default, readonly, disabled and a readonly range.
    project: 'core-slider',
    owes: [
      '`showTicks`',
      'the `tooltip` bubble, default and `*mlvSliderTooltipDef` template',
      '`orientation="vertical"`',
    ],
  },
  'core-speed-dial',
  {
    // #301 swept default with a value and its clear button, readonly, disabled.
    project: 'core-textarea',
    owes: [
      'the `maxLength` character counter',
      'a `hint` inside the label',
      'error + `description` + `message`',
      'auto-resize with the custom scrollbar overflowing',
    ],
  },
  'core-toast',
  {
    // #301 swept two tokens with the clear button, readonly, disabled.
    project: 'core-tokenizer',
    owes: [
      'an armed (Backspace-selected) token and its live region',
      '`showOverflow` with the `+N` counter',
      'a `tokenTemplate`',
      'a `hint` inside the label',
      'an empty tokenizer',
      'error + `description` + `message`',
    ],
  },
  'core-tree',
];

/** Longest sweep root reported verbatim before it is elided. */
const MAX_ROOT_LENGTH = 60;

/** Workspace-relative path with forward slashes, whatever the platform uses. */
const toPosix = (path) => path.split(sep).join('/');

/**
 * Normalizes one {@link ROLLOUT_PENDING} entry of either shape.
 *
 * A malformed entry is returned as a `malformed` reason rather than dropped.
 * Dropping it would remove the project from the tracker AND from the
 * `uncovered` question in a single step, which is the silent hole the whole
 * guard exists to make impossible — and a typo in an object literal is a much
 * easier mistake to make than a typo in a bare string.
 *
 * @param {ReadonlyArray<unknown>} entries
 * @returns {Array<{ project: string, owes: string[] | null, malformed: string | null }>}
 */
export function normalizeRolloutPending(entries) {
  const isName = (value) => typeof value === 'string' && value.trim() !== '';

  return [...entries].map((entry, index) => {
    if (isName(entry)) return { project: entry, owes: null, malformed: null };

    const named = entry && typeof entry === 'object' && isName(entry.project);
    const project = named ? entry.project : `(entry ${index})`;

    if (!named) {
      return {
        project,
        owes: null,
        malformed:
          'is neither a project name nor an object with a non-empty `project`',
      };
    }
    if (!Array.isArray(entry.owes) || entry.owes.length === 0) {
      return {
        project,
        owes: null,
        malformed:
          '`owes` must be a non-empty array naming the states still unswept',
      };
    }
    if (!entry.owes.every(isName)) {
      return {
        project,
        owes: null,
        malformed: 'every `owes` item must be a non-empty state name',
      };
    }
    return { project, owes: [...entry.owes], malformed: null };
  });
}

/**
 * Blanks out line and block comments, keeping every other index where it was.
 *
 * A commented-out call is not a call. Without this a spec that keeps its helper
 * `import` and comments its only assertion out reads as covered — and, since
 * #257, also PRINTS a root for an assertion that never runs, which points a
 * reviewer at the one conclusion the evidence channel exists to prevent.
 *
 * Comment bodies become spaces rather than being removed so offsets stay
 * aligned with the original text and newlines survive; the caller can therefore
 * scan the stripped text and still reason about the file it came from.
 *
 * Quote-aware, so a `//` inside a string literal (a URL) is left alone. NOT
 * regex-aware — see {@link readSweepRoot}, which shares the limitation.
 *
 * @param {string} text
 * @returns {string} `text` with comment bodies replaced by spaces.
 */
export const stripComments = (text) => {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      // Newlines are kept so the stripped text still has the file's line breaks.
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      out += char;
      i += 1;
      while (i < text.length) {
        const inner = text[i];
        out += inner;
        i += 1;
        if (inner === '\\' && i < text.length) {
          out += text[i];
          i += 1;
          continue;
        }
        if (inner === char) break;
        // `'` and `"` cannot span a raw newline in valid TypeScript, so a
        // newline means the opening quote was not one — bail rather than
        // swallowing the rest of the file.
        if (inner === '\n' && char !== '`') break;
      }
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
};

/**
 * The first argument of a helper call, as written in the spec.
 *
 * A balanced scan rather than a `[^,)]*` match: the roots worth telling a
 * reviewer apart are exactly the ones that contain their own parens and commas
 * (`document.querySelector('.cdk-overlay-container')`), and truncating those at
 * the first delimiter would produce evidence that misleads.
 *
 * Known limitation, stated rather than papered over: the scan tracks quotes but
 * not regex literals, so a `'` inside one (`el.matches(/it's/)`) opens quote
 * mode and the reported root is wrong to the end of that line. It is
 * reporting-only — no finding branches on a root, and the whole workspace has
 * zero corrupted roots today — so the honest fix is a real lexer, and a
 * heuristic that guessed regex-vs-division would trade a rare wrong string for
 * a rare wrong string plus 40 lines. What IS bounded: an unterminated `'`/`"`
 * stops at the newline instead of eating the rest of the file, and callers hand
 * this stripped text ({@link stripComments}), which removes the far more
 * ordinary version of the same trap — an apostrophe in a comment inside a
 * multi-line call.
 *
 * @param {string} text Full file text, comments already stripped.
 * @param {number} from Index just past the call's opening paren.
 * @returns {string} The argument text, verbatim and unnormalized.
 */
const readSweepRoot = (text, from) => {
  let depth = 0;
  let quote = null;
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (char === '\\') i += 1;
      // `'` and `"` cannot span a raw newline in valid TypeScript, so a newline
      // means the opening quote was not one. Bail instead of running to EOF:
      // that bounds a misread (a regex literal, below) to one line.
      else if (char === quote || (char === '\n' && quote !== '`')) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') {
      if (depth === 0) return text.slice(from, i);
      depth -= 1;
    } else if (char === ',' && depth === 0) return text.slice(from, i);
  }
  return text.slice(from);
};

/**
 * Every helper call in one spec, with the root it swept.
 *
 * Reporting only — nothing branches on a root. A rule of the form "a project
 * that reaches an overlay must sweep something other than `fixture.nativeElement`"
 * would be a heuristic over source text that both false-negatives (a component
 * can portal content without naming `Overlay` in its own sources) and
 * false-positives (a project can name it and portal nothing); the point here is
 * to put the evidence in front of the human making the call.
 *
 * @param {string} file
 * @param {string} text Spec text with comments already stripped.
 * @returns {Array<{ spec: string, root: string }>} One entry per helper call.
 */
const collectSweeps = (file, text) => {
  const pattern = new RegExp(HELPER_CALL.source, 'g');
  const sweeps = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const raw = readSweepRoot(text, match.index + match[0].length)
      .replace(/\s+/g, ' ')
      .trim();
    const root =
      raw.length > MAX_ROOT_LENGTH
        ? `${raw.slice(0, MAX_ROOT_LENGTH - 1)}…`
        : raw || '(no argument)';
    // Store a fresh flat COPY. `readSweepRoot` returns a slice of the whole
    // spec, and `replace`, `trim` and `slice` all hand the receiver straight
    // back when they have nothing to do — so a 20-character root would keep its
    // entire source file alive for the life of the report (measured: 40 MB for
    // eight sweeps of a 5 MB spec). A one-element `split`/`join` does not fix
    // it either, because `join` over a single element returns that element and
    // a bare `document.body` has no whitespace to split on. Spreading to
    // characters and re-joining is the step that always allocates.
    sweeps.push({ spec: file, root: [...root].join('') });
  }
  return sweeps;
};

/**
 * Recursively collect TypeScript files under `dir`, skipping nested projects.
 *
 * A failed read is pushed onto `errors` rather than swallowed. Swallowing it is
 * how the whole guard goes quiet: with no files walked, every project resolves
 * `rendersDom: false, hasAxe: false`, three of the four findings can no longer
 * fire, and the summary still prints OK.
 */
const collectSources = (dir, nestedRoots, found = [], errors = []) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    errors.push(`${toPosix(relative(WORKSPACE_ROOT, dir))}: ${error.message}`);
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      if (nestedRoots.has(relative(WORKSPACE_ROOT, full))) continue;
      collectSources(full, nestedRoots, found, errors);
    } else if (SOURCE_PATTERN.test(entry.name)) {
      found.push(toPosix(relative(WORKSPACE_ROOT, full)));
    }
  }
  return found;
};

/**
 * Every project with its resolved config, in ONE nx invocation — the same trick
 * `check-test-targets.mjs` uses, for the same reason (~25s of `nx show project`
 * against ~1s for the graph dump).
 */
const readProjects = () => {
  const dir = mkdtempSync(join(tmpdir(), 'mlv-axe-coverage-'));
  const file = join(dir, 'graph.json');
  try {
    execFileSync('npx', ['nx', 'graph', '--file', file], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    const { graph } = JSON.parse(readFileSync(file, 'utf8'));
    return new Map(
      Object.entries(graph.nodes).map(([name, node]) => [name, node.data]),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/**
 * Derives the facts about one project from the files it owns.
 *
 * Pure: the caller supplies the file list and a reader, so
 * `check-axe-coverage.spec.mjs` can pin the answers against synthetic trees
 * without an `nx graph` round trip.
 *
 * @param {{ root: string, files: readonly string[], readFile: (file: string) => string }} project
 * @returns {{
 *   rendersDom: boolean,
 *   hasAxe: boolean,
 *   sweeps: Array<{ spec: string, root: string }>,
 *   rawAxeSpecs: string[],
 * }}
 */
export function analyzeProject({ root, files, readFile }) {
  // A project's own top-level `e2e/`, not any directory that happens to be
  // named that. An unanchored `e2e` segment is an escape hatch anyone can open
  // by naming a folder: `libs/core/button/src/lib/e2e/probe.spec.ts` is a jsdom
  // vitest spec that `core-button:test` really runs.
  const e2ePrefix = `${toPosix(root)}/e2e/`;

  let rendersDom = false;
  let usesHelper = false;
  const rawAxeSpecs = [];
  const sweeps = [];

  for (const file of files) {
    const text = readFile(file);
    if (!SPEC_PATTERN.test(file)) {
      if (RENDERS_DOM.test(text)) rendersDom = true;
      continue;
    }
    // A Playwright suite injects `axe.source` into a real browser page; the
    // jsdom helper (and its `vitest` `expect`) has no meaning there. That buys
    // it an exemption from the raw-import rule and NOTHING else — it is not a
    // jsdom sweep, so it cannot stand in for one.
    if (toPosix(file).startsWith(e2ePrefix)) continue;

    // Each predicate reads whichever text errs toward REPORTING. Coverage is
    // the claim that can hide a defect, so it is asked of the code that will
    // actually run: a commented-out import or call buys nothing. `RENDERS_DOM`
    // and `RAW_AXE_IMPORT` only ever add findings, so they stay on the raw text
    // and a commented-out one is still surfaced for a human to dismiss.
    const code = stripComments(text);

    if (HELPER_IMPORT.test(code) && HELPER_CALL.test(code)) {
      usesHelper = true;
      // Gated on the import deliberately: evidence is collected under exactly
      // the rule `hasAxe` has always used, so the two can never disagree about
      // whether a file counts.
      sweeps.push(...collectSweeps(file, code));
    }
    if (RAW_AXE_IMPORT.test(text)) rawAxeSpecs.push(file);
  }

  return {
    rendersDom,
    hasAxe: usesHelper || rawAxeSpecs.length > 0,
    sweeps,
    rawAxeSpecs,
  };
}

/**
 * Turns the per-project facts into the reported findings.
 *
 * @param {{
 *   facts: Map<string, {
 *     scope: 'library' | 'application',
 *     root: string,
 *     rendersDom: boolean,
 *     hasAxe: boolean,
 *     sweeps?: Array<{ spec: string, root: string }>,
 *     rawAxeSpecs: string[],
 *     fileCount: number,
 *     srcNonEmpty: boolean,
 *     walkErrors: string[],
 *   }>,
 *   exempt?: Record<string, { rendersDom: boolean, reason: string }>,
 *   rolloutPending?: ReadonlyArray<string | { project: string, owes: readonly string[] }>,
 * }} input
 */
export function buildFindings({
  facts,
  exempt = EXEMPT,
  rolloutPending = ROLLOUT_PENDING,
}) {
  const findings = [];
  const libraries = [...facts].filter(([, fact]) => fact.scope === 'library');
  const renders = libraries.filter(([, fact]) => fact.rendersDom).length;
  const rollout = normalizeRolloutPending(rolloutPending);
  // A malformed entry protects nothing. Leaving it out of the suppression set
  // is the safe direction: the project is reported `uncovered` as well, which
  // is two true findings rather than one silent hole.
  const tracked = new Set(
    rollout.filter((e) => !e.malformed).map((e) => e.project),
  );

  // 0. The floor. Everything below is derived from files read off disk, and a
  //    walk that saw nothing answers every one of those questions with
  //    "nothing wrong". Assert the walk worked before trusting any of it.
  for (const [name, fact] of facts) {
    for (const error of fact.walkErrors) {
      findings.push({
        kind: 'walk-error',
        project: name,
        root: fact.root,
        message: `could not be walked (${error})`,
        fix: 'Fix the unreadable path. Until the walk completes, this project’s coverage answer is not evidence of anything.',
      });
    }
    if (fact.fileCount === 0 && fact.srcNonEmpty) {
      findings.push({
        kind: 'no-sources',
        project: name,
        root: fact.root,
        message:
          'has a non-empty src/ but the walk found no TypeScript in it, so every answer about it is vacuous',
        fix: 'Check SOURCE_PATTERN and IGNORED_DIRS against what the project actually holds. A project that genuinely owns no TypeScript (a CSS-only adapter) has no src/ at all and is not reported here.',
      });
    }
  }
  if (libraries.length === 0) {
    findings.push({
      kind: 'floor',
      project: '(workspace)',
      message:
        'no libs/ library projects were resolved at all — the graph or the root filter is broken, and a clean report here would mean nothing',
      fix: 'Check `nx graph` output and the libs/ + projectType filter in this file.',
    });
  } else if (renders === 0) {
    findings.push({
      kind: 'floor',
      project: '(workspace)',
      message: `resolved ${libraries.length} libs/ library project(s) but not one of them renders DOM, which cannot be true of this workspace`,
      fix: 'Check RENDERS_DOM and the walk. With no DOM-rendering project, the uncovered / stale-exempt / stale-rollout checks are all silent by construction.',
    });
  }

  // 1. Uncovered projects that neither list accounts for.
  for (const [name, fact] of libraries) {
    if (!fact.rendersDom || fact.hasAxe) continue;
    if (name in exempt || tracked.has(name)) continue;
    findings.push({
      kind: 'uncovered',
      project: name,
      root: fact.root,
      message:
        'declares an @Component/@Directive but no spec it owns asserts with axe',
      fix: "Add `await expectNoAxeViolations(host)` from '@malva-ui/internal-testing/axe' to one of its specs. If it genuinely emits nothing axe can judge, add it to EXEMPT in this file with the reason.",
    });
  }

  // 2. Stale ROLLOUT_PENDING entries. Checked in both directions, because the
  //    two shapes go wrong in opposite ways: a bare entry must stay unswept,
  //    and an `owes` entry must have a sweep to be partial to. Neither check
  //    reads the `owes` STRINGS, and neither can — the guard has no idea what
  //    states a project has. So over a project with at least one sweep, `owes`
  //    is accepted whatever it says and is a permanent silencer; the second
  //    direction only catches the one case that needs no state knowledge. See
  //    ROLLOUT_PENDING's own comment for what the annotation does buy.
  for (const entry of rollout) {
    const { project: name, owes, malformed } = entry;
    if (malformed) {
      findings.push({
        kind: 'stale-rollout',
        reason: 'malformed',
        project: name,
        message: `is not a usable ROLLOUT_PENDING entry: it ${malformed}`,
        fix: "Write either a bare project name ('core-x') when nothing is swept, or { project: 'core-x', owes: ['open panel'] } when some states are swept and others are not.",
      });
      continue;
    }

    const fact = facts.get(name);
    if (!fact || fact.scope !== 'library') {
      findings.push({
        kind: 'stale-rollout',
        reason: 'unknown-project',
        project: name,
        message:
          'is listed in ROLLOUT_PENDING but is not a libs/ library project',
        fix: 'Remove the line, or correct the project name.',
      });
      continue;
    }

    const sweeps = fact.sweeps ?? [];
    const roots = [...new Set(sweeps.map((s) => s.root))];

    if (owes === null && fact.hasAxe) {
      findings.push({
        kind: 'stale-rollout',
        reason: 'gained-sweep',
        project: name,
        root: fact.root,
        sweepCount: sweeps.length,
        sweepRoots: roots,
        message:
          'now asserts with axe, so its bare ROLLOUT_PENDING line no longer describes it' +
          (sweeps.length > 0
            ? ` (${sweeps.length} sweep${sweeps.length === 1 ? '' : 's'}, against ${roots.join(', ')})`
            : ''),
        fix:
          "If that covers every state that changes the markup, delete the line. If it does not — a panel, a dropdown, an expanded row, an overlay the fixture does not contain — replace the line with { project: '" +
          name +
          "', owes: ['<state>'] } so the rest stays tracked. One sweep is not a promise of full coverage (#257).",
      });
      // `sweeps`, not `hasAxe`: the entry claims some states ARE swept, and
      // `hasAxe` is also true for a project whose only "coverage" is a banned
      // `import axe from 'axe-core'`, which is not a sweep through the helper
      // and cannot be the thing the annotation is describing. Belt-and-braces —
      // the run still exits 1 on `raw-axe-import` — but this is the predicate
      // `fact.sweeps` was introduced to let us write.
    } else if (owes !== null && sweeps.length === 0) {
      findings.push({
        kind: 'stale-rollout',
        reason: 'no-sweep',
        project: name,
        root: fact.root,
        sweepCount: 0,
        sweepRoots: [],
        message: `is recorded as partially swept (owes ${owes.join(', ')}) but asserts with axe nowhere`,
        fix: 'Either add the sweep the entry claims already exists, or reduce the entry to the bare project name, which is what "nothing swept yet" is written as.',
      });
    }
  }

  // 3. Stale EXEMPT entries.
  for (const [name, entry] of Object.entries(exempt)) {
    const fact = facts.get(name);
    if (!fact || fact.scope !== 'library') {
      findings.push({
        kind: 'stale-exempt',
        project: name,
        message: 'is listed in EXEMPT but is not a libs/ library project',
        fix: 'Remove the entry, or correct the project name.',
      });
      continue;
    }
    if (fact.rendersDom !== entry.rendersDom) {
      findings.push({
        kind: 'stale-exempt',
        project: name,
        root: fact.root,
        message: entry.rendersDom
          ? 'no longer declares an @Component/@Directive, so its exemption reason has drifted'
          : 'has started declaring an @Component/@Directive, and its exemption rests on it declaring none',
        fix: 'Re-read the reason against what the project now emits: either cover it with a sweep and delete the entry, or rewrite the reason and update `rendersDom`.',
      });
    }
    if (fact.hasAxe) {
      findings.push({
        kind: 'stale-exempt',
        project: name,
        root: fact.root,
        message: 'is exempt but does assert with axe',
        fix: 'Delete the EXEMPT entry — the sweep is the better answer and the exemption now hides it.',
      });
    }
  }

  // 4. Specs that bypass the shared helper. Applications included: this is a
  //    rule about how a spec is written, not about which surface is shipped.
  for (const [name, fact] of facts) {
    for (const spec of fact.rawAxeSpecs) {
      findings.push({
        kind: 'raw-axe-import',
        project: name,
        spec,
        message: "imports 'axe-core' directly instead of the shared helper",
        fix: "Use `expectNoAxeViolations` (or `runAxe` when the spec asserts that a violation IS raised) from '@malva-ui/internal-testing/axe'.",
      });
    }
  }

  return findings;
}

/** Walks the workspace and reports. Only runs when this file is the entry point. */
const main = () => {
  const args = new Set(process.argv.slice(2));
  const configs = readProjects();
  const roots = new Set(
    [...configs.values()].map((c) => c.root).filter((r) => r && r !== '.'),
  );

  /** Per-project facts, derived fresh on every run. */
  const facts = new Map();

  for (const [name, config] of configs) {
    const root = config.root ? toPosix(config.root) : '';
    const scope =
      root.startsWith('libs/') && config.projectType === 'library'
        ? 'library'
        : root.startsWith('apps/') && config.projectType === 'application'
          ? 'application'
          : null;
    if (!scope) continue;

    const absolute = join(WORKSPACE_ROOT, config.root);
    if (!existsSync(absolute)) continue;

    const nested = new Set([...roots].filter((r) => r !== config.root));
    const walkErrors = [];
    const walked = collectSources(absolute, nested, [], walkErrors);

    // An application is asked question 3 and nothing else, and question 3 only
    // ever reads specs. Narrowing the file list here is what keeps
    // `{workspaceRoot}/**/*.{spec,test}.*` an exactly-sufficient cache input
    // for the application half of this guard — no `apps/**/*.ts` glob needed,
    // and no application source read for an answer nothing consumes.
    const files =
      scope === 'application'
        ? walked.filter((f) => SPEC_PATTERN.test(f))
        : walked;

    const src = join(absolute, 'src');
    let srcNonEmpty = false;
    try {
      // Library-only: the floor asks whether the library walk saw anything,
      // because that walk going quiet is what silences questions 1-3. An
      // application legitimately owns sources this run never lists.
      srcNonEmpty =
        scope === 'library' && existsSync(src) && readdirSync(src).length > 0;
    } catch (error) {
      walkErrors.push(`${root}/src: ${error.message}`);
    }

    facts.set(name, {
      scope,
      root,
      fileCount: files.length,
      srcNonEmpty,
      walkErrors,
      ...analyzeProject({
        root,
        files,
        readFile: (file) => readFileSync(join(WORKSPACE_ROOT, file), 'utf8'),
      }),
    });
  }

  const findings = buildFindings({ facts });
  const libraries = [...facts.values()].filter((f) => f.scope === 'library');
  const apps = [...facts.values()].filter((f) => f.scope === 'application');
  const covered = libraries.filter((f) => f.hasAxe).length;
  const renders = libraries.filter((f) => f.rendersDom).length;

  const rollout = normalizeRolloutPending(ROLLOUT_PENDING);
  const partial = rollout.filter((e) => e.owes !== null).length;
  const sweepCount = [...facts.values()]
    .filter((f) => f.scope === 'library')
    .reduce((n, f) => n + f.sweeps.length, 0);

  if (args.has('--json')) {
    console.log(
      JSON.stringify(
        {
          findings,
          summary: {
            projects: libraries.length,
            apps: apps.length,
            files: [...facts.values()].reduce((n, f) => n + f.fileCount, 0),
            rendersDom: renders,
            covered,
            sweeps: sweepCount,
            exempt: Object.keys(EXEMPT).length,
            rolloutPending: ROLLOUT_PENDING.length,
            rolloutPartial: partial,
          },
          // Per-project sweep evidence (#257). Nothing branches on it — it is
          // here so a reviewer can see "1 sweep, and it swept the fixture"
          // without opening the specs, which is the fact a coverage boolean
          // structurally cannot carry.
          sweeps: Object.fromEntries(
            [...facts]
              .filter(([, f]) => f.scope === 'library' && f.sweeps.length > 0)
              .map(([name, f]) => [name, f.sweeps]),
          ),
          exempt: EXEMPT,
          rolloutPending: ROLLOUT_PENDING,
        },
        null,
        2,
      ),
    );
  } else if (findings.length > 0) {
    console.error('axe coverage findings:\n');
    for (const finding of findings) {
      const where = finding.spec ?? finding.root ?? '';
      console.error(`  ${finding.project}${where ? ` (${where})` : ''}`);
      console.error(`    ${finding.message}`);
      console.error(`    ${finding.fix}\n`);
    }
    console.error(
      `[check-axe-coverage] ${findings.length} finding(s). See #47 and .claude/rules/accessibility.md.`,
    );
  } else if (!args.has('--quiet')) {
    console.log(
      `[check-axe-coverage] ${covered}/${renders} DOM-rendering library projects assert with axe ` +
        `(${sweepCount} sweep(s); \`--json\` lists them per project); ` +
        `${ROLLOUT_PENDING.length} pending rollout (#47), ${partial} of them partially swept, ` +
        `${Object.keys(EXEMPT).length} exempt; ` +
        `${apps.length} application(s) swept for raw axe imports. OK`,
    );
  }

  process.exit(findings.length > 0 ? 1 : 0);
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
