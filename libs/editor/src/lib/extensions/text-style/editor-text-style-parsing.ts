import type { Editor, Extension, GlobalAttributes } from '@tiptap/core';
import type { Schema, TagParseRule } from '@tiptap/pm/model';

/**
 * @internal Inline-style properties another mark of the preset owns: a
 * `background-color` span is a highlight, a `vertical-align` span is a
 * sub / superscript. A span declaring nothing else is not a text style.
 */
const STYLES_OWNED_BY_OTHER_MARKS: ReadonlySet<string> = new Set([
  'background-color',
  'vertical-align',
]);

/**
 * @private `background-color` values that paint nothing: the empty string (a
 * value the engine could not parse), `transparent` and the CSS-wide keywords.
 */
const NO_BACKGROUND_KEYWORDS: ReadonlySet<string> = new Set([
  '',
  'transparent',
  'initial',
  'inherit',
  'unset',
  'revert',
  'revert-layer',
]);

/**
 * @internal Whether a `background-color` value paints anything. `false` for
 * {@link NO_BACKGROUND_KEYWORDS}, for `#RGBA` / `#RRGGBBAA` with alpha 0, and
 * for a colour function whose own alpha — after its `/`, or its fourth comma
 * argument — is 0, `0%` or `none`. Google Docs declares
 * `background-color: transparent` on every run it copies, so a span rule
 * without this check turned every pasted paragraph into a highlight.
 *
 * @param value The declared value, as `element.style.backgroundColor` reads it.
 */
export function paintsBackground(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (NO_BACKGROUND_KEYWORDS.has(normalized)) return false;
  const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/.exec(normalized)?.[1];
  if (hex) return hex.length === 4 ? hex[3] !== '0' : hex.slice(6) !== '00';
  const args = /^[a-z-]+\((.*)\)$/.exec(normalized)?.[1];
  if (args === undefined) return true;
  const alpha = outerAlpha(args);
  if (alpha === undefined) return true;
  if (alpha.trim() === 'none') return false;
  const amount = Number.parseFloat(alpha);
  return Number.isNaN(amount) || amount > 0;
}

/**
 * @private The alpha argument of a colour function: what follows its last `/`,
 * or its fourth comma argument, counted only at nesting depth 0. A `/` or
 * comma inside a nested function (`light-dark(rgb(0 0 0 / 0), red)`,
 * `color-mix(…)`) belongs to an inner colour, so it yields `undefined` and the
 * value counts as painting.
 *
 * @param args The outer function's arguments, without its parentheses.
 */
function outerAlpha(args: string): string | undefined {
  let depth = 0;
  let slash = -1;
  const commas: number[] = [];
  for (let index = 0; index < args.length; index++) {
    const char = args[index];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0 && char === '/') slash = index;
    else if (depth === 0 && char === ',') commas.push(index);
  }
  if (slash >= 0) return args.slice(slash + 1);
  return commas.length === 3 ? args.slice(commas[2] + 1) : undefined;
}

/**
 * @internal Whether a span's inline style declares only properties another
 * mark owns. `false` for a span with no declarations, which keeps upstream's
 * behaviour for `style=""`.
 */
export function declaresOnlyOtherMarkStyles(element: HTMLElement): boolean {
  const { style } = element;
  if (style.length === 0) return false;
  for (let index = 0; index < style.length; index++) {
    if (!STYLES_OWNED_BY_OTHER_MARKS.has(style.item(index))) return false;
  }
  return true;
}

/**
 * @internal Wraps a text-style parse rule so a span whose style another mark
 * fully owns creates no `textStyle`. Upstream's rule accepts any span with a
 * `style` attribute, so a pasted `<span style="background-color: …">` became
 * a highlight wrapped in an attribute-less `<span>` on output.
 */
export function skipSpansOwnedByOtherMarks(rule: TagParseRule): TagParseRule {
  return {
    ...rule,
    getAttrs: (element) => {
      if (declaresOnlyOtherMarkStyles(element)) return false;
      return rule.getAttrs ? rule.getAttrs(element) : (rule.attrs ?? null);
    },
  };
}

/** @private CSS property each text-style attribute of the schema is read from. */
const TEXT_STYLE_ATTRIBUTE_PROPERTIES: Readonly<Record<string, string>> = {
  color: 'color',
  fontFamily: 'font-family',
  fontSize: 'font-size',
  lineHeight: 'line-height',
  backgroundColor: 'background-color',
};

/**
 * @private The `vertical-align` values a script mark reads from a span, keyed
 * by mark name.
 */
const SCRIPT_MARK_VALUES: Readonly<Record<string, string>> = {
  subscript: 'sub',
  superscript: 'super',
};

/** @private What a schema stores from a span's inline style. */
interface SpanStyleReaders {
  /** Properties an attribute of the `textStyle` mark stores. */
  readonly textStyle: ReadonlySet<string>;
  /**
   * `property` or `property:value` declarations a mark ordered before
   * `textStyle` reads through a span tag rule (`span[style*="…"]`). Those
   * rules run before the text-style rules, so their marks are already set.
   */
  readonly otherMarks: ReadonlySet<string>;
}

/** @private Readers per schema; a schema is immutable, so this never goes stale. */
const READERS = new WeakMap<Schema, SpanStyleReaders>();

/** @private Collects what `schema` stores from a span's inline style. */
function spanStyleReaders(schema: Schema): SpanStyleReaders {
  const cached = READERS.get(schema);
  if (cached) return cached;
  const textStyle = new Set<string>();
  for (const name of Object.keys(schema.marks['textStyle']?.spec.attrs ?? {})) {
    const property = TEXT_STYLE_ATTRIBUTE_PROPERTIES[name];
    if (property) textStyle.add(property);
  }
  const otherMarks = new Set<string>();
  const names = Object.keys(schema.marks);
  const before = names.slice(0, Math.max(0, names.indexOf('textStyle')));
  const readsSpan = (name: string, property: string): boolean =>
    (schema.marks[name]?.spec.parseDOM ?? []).some(
      (rule) =>
        'tag' in rule &&
        typeof rule.tag === 'string' &&
        rule.tag.startsWith(`span[style*="${property}"]`),
    );
  if (
    before.includes('highlight') &&
    readsSpan('highlight', 'background-color')
  ) {
    otherMarks.add('background-color');
  }
  for (const [name, value] of Object.entries(SCRIPT_MARK_VALUES)) {
    if (before.includes(name) && readsSpan(name, 'vertical-align')) {
      otherMarks.add(`vertical-align:${value}`);
    }
  }
  const readers = { textStyle, otherMarks };
  READERS.set(schema, readers);
  return readers;
}

/**
 * @private Sorts a span's inline declarations: `'text-style'` when every one
 * is stored and at least one by `textStyle`, `'other-marks'` when every one is
 * stored by another mark, `null` when any is stored by nothing — or the span
 * carries an attribute besides `style`, which no rule here accounts for.
 */
function classifyStyledSpan(
  element: HTMLElement,
  schema: Schema,
): 'text-style' | 'other-marks' | null {
  const { style } = element;
  if (element.attributes.length !== 1 || style.length === 0) return null;
  const readers = spanStyleReaders(schema);
  let textStyle = false;
  for (let index = 0; index < style.length; index++) {
    const property = style.item(index);
    if (readers.textStyle.has(property)) {
      textStyle = true;
    } else if (
      !readers.otherMarks.has(property) &&
      !readers.otherMarks.has(
        `${property}:${style.getPropertyValue(property).trim()}`,
      )
    ) {
      return null;
    }
  }
  return textStyle ? 'text-style' : 'other-marks';
}

/**
 * @internal Rules that let a strict load accept a span whose whole inline
 * style the schema stores — the span the editor itself writes for colour, font
 * family and font size.
 *
 * Upstream's text-style rule does not consume its span, so ProseMirror keeps
 * matching, and a strict load (`enableContentCheck` + `errorOnInvalidContent`,
 * which `MlvEditor` uses) appends a catch-all node rule that flags whatever
 * reaches it: every `<span style>` value failed with a `parse` error, colour
 * included. These rules run first and end the match for such a span:
 *
 * - `text-style` span: a consuming `textStyle` rule (Tiptap injects the
 *   attributes); inline style rules still run, as before.
 * - `other-marks` span (a highlight's `background-color`, a script's
 *   `vertical-align`): a `skip` rule, so no empty `textStyle` is created and
 *   the marks the earlier span rules set carry over to the content.
 *
 * A span with any other declaration or attribute falls through to upstream's
 * rule and still fails a strict load, so a schema that cannot store a style
 * never drops it silently. Without an editor (a standalone schema, where no
 * strict load happens) neither rule matches.
 *
 * @param editor The editor owning the schema, from the extension context.
 */
export function storedStyleSpanRules(
  editor: Editor | undefined,
): readonly TagParseRule[] {
  const matches =
    (kind: 'text-style' | 'other-marks') =>
    (element: HTMLElement): null | false =>
      editor && classifyStyledSpan(element, editor.schema) === kind
        ? null
        : false;
  return [
    { tag: 'span[style]', getAttrs: matches('text-style') },
    { tag: 'span[style]', skip: true, getAttrs: matches('other-marks') },
  ];
}

/**
 * @internal Returns an extension whose global attributes read an absent
 * inline style as `null` rather than `''`. Upstream reads
 * `element.style.fontFamily` (and `fontSize`, `color`) as a fallback, which is
 * `''` whenever the span carries some other property, so a pasted colour span
 * stored `fontFamily: ''` and `fontSize: ''` next to its colour, and a JSON
 * round trip through Markdown compared unequal.
 */
export function withAbsentStyleAsNull<Options, Storage>(
  extension: Extension<Options, Storage>,
): Extension<Options, Storage> {
  return extension.extend({
    addGlobalAttributes() {
      const groups: GlobalAttributes = this.parent?.() ?? [];
      return groups.map((group) => ({
        ...group,
        attributes: Object.fromEntries(
          Object.entries(group.attributes).map(([name, attribute]) => {
            const parse = attribute?.parseHTML;
            return [
              name,
              parse
                ? {
                    ...attribute,
                    parseHTML: (element: HTMLElement) => parse(element) || null,
                  }
                : attribute,
            ];
          }),
        ),
      }));
    },
  });
}
