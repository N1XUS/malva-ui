import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import type Postcss from 'postcss';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';

// `sass` and `postcss` are Node-only; `createRequire` keeps them out of the
// browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const postcss = nodeRequire('postcss') as typeof Postcss;

// Resolved from this file: the `@nx/vitest:test` executor runs from the root.
const HERE = dirname(fileURLToPath(import.meta.url));

const css = postcss.parse(
  stripCssLayersFromText(sass.compile(resolve(HERE, 'editor.scss')).css),
);

/** Declarations of every rule listing exactly `selector`, later ones winning. */
function declarations(
  selector: string,
  inMedia?: string,
): Record<string, string> {
  const found: Record<string, string> = {};
  css.walkRules((rule) => {
    const selectors = rule.selectors.map((s) => s.replace(/\s+/g, ' ').trim());
    if (!selectors.includes(selector)) return;
    const media =
      rule.parent?.type === 'atrule'
        ? (rule.parent as Postcss.AtRule).params
        : undefined;
    if (media !== inMedia) return;
    rule.each((node) => {
      if (node.type === 'decl') found[node.prop] = node.value;
    });
  });
  return found;
}

/** Rules under `(hover: none)` naming the copy-link button, by selector. */
function touchRules(): Record<string, Record<string, string>> {
  const found: Record<string, Record<string, string>> = {};
  css.walkAtRules('media', (media) => {
    if (media.params !== '(hover: none)') return;
    media.walkRules((rule) => {
      for (const raw of rule.selectors) {
        const selector = raw.replace(/\s+/g, ' ').trim();
        if (!selector.includes('.mlv-editor__heading-link')) continue;
        rule.each((node) => {
          if (node.type === 'decl') {
            found[selector] = { ...found[selector], [node.prop]: node.value };
          }
        });
      }
    });
  });
  return found;
}

/** Editors created by the view-level spec, destroyed after each test. */
const editors: Editor[] = [];

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  document.body.replaceChildren();
});

describe('heading copy-link styles', () => {
  const link = '.mlv-editor__heading-link';

  it('keeps a 1.5rem target without growing the heading line', () => {
    const rules = declarations(link);
    expect(rules['inline-size']).toBe('1.5rem');
    expect(rules['block-size']).toBe('1.5rem');
    expect(rules['margin-block']).toBe('-0.25rem');
    expect(rules['margin-inline-start']).toBe('var(--mlv-spacing-2)');
    expect(rules['user-select']).toBe('none');
  });

  it('is hidden until hover, focus or the caret shows it', () => {
    expect(declarations(link)['opacity']).toBe('0');
    for (const shown of [
      `.mlv-editor .ProseMirror h2:hover ${link}`,
      `.mlv-editor .ProseMirror h2:focus-within ${link}`,
      `.mlv-editor .ProseMirror.ProseMirror-focused .mlv-editor__heading--caret ${link}`,
    ]) {
      expect(declarations(shown)['opacity']).toBe('1');
    }
  });

  it('shows the readonly tab stop on touch, where no hover reveals it', () => {
    // Without this a touch reader gets an invisible target at every heading's
    // end: opacity keeps it hit-testable, so a tap near it copies a link.
    const readonly = `.mlv-editor .ProseMirror[contenteditable=false] ${link}`;
    expect(touchRules()).toMatchObject({ [readonly]: { opacity: '1' } });
    expect(touchRules()[readonly]?.['pointer-events']).toBeUndefined();
  });

  it('takes taps on the editable button only while it is shown on touch', () => {
    // Hidden = not focused, or focused with the caret in another block. A tap
    // there would copy a link instead of placing the caret, so it goes
    // through to the heading text; the caret rule is exactly the complement.
    const editable = '.mlv-editor .ProseMirror[contenteditable=true]';
    const untappable = [
      `${editable}:not(.ProseMirror-focused) ${link}`,
      `${editable}.ProseMirror-focused .mlv-editor__heading:not(.mlv-editor__heading--caret) ${link}`,
    ];
    const rules = touchRules();
    for (const selector of untappable) {
      expect(rules[selector]).toEqual({ 'pointer-events': 'none' });
    }
    // Only the readonly rule and these two touch the button on touch, and no
    // rule outside the media query disables it, so a shown button stays
    // tappable.
    expect(Object.keys(rules).sort()).toEqual(
      [
        `.mlv-editor .ProseMirror[contenteditable=false] ${link}`,
        ...untappable,
      ].sort(),
    );
    expect(declarations(link)['pointer-events']).toBeUndefined();
  });

  it('leaves the button tappable in the view exactly while it is shown', () => {
    // The compiled touch selectors, matched against a real view's DOM.
    const untappable = Object.entries(touchRules())
      .filter(([, rules]) => rules['pointer-events'] === 'none')
      .map(([selector]) => selector)
      .join(', ');
    expect(untappable).not.toBe('');
    const element = document.createElement('div');
    element.className = 'mlv-editor';
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: mlvEditorDefaultExtensions({ headingAnchors: true }),
    });
    editors.push(editor);
    // Anchors are derived by a transaction, as when `MlvEditor` loads a value.
    editor.commands.setContent('<h2>Intro</h2><h2>Other</h2><p>Body</p>');
    const storage = editor.storage.headingAnchors;
    storage.copy = vi.fn(() => true);
    storage.announce = vi.fn();
    storage.label = () => 'Copy link to heading';
    storage.disabled = () => false;
    editor.view.updateState(editor.state);
    const tappable = (): boolean[] =>
      [...element.querySelectorAll(link)].map(
        (button) => !button.matches(untappable),
      );
    // Editable, not focused: hidden at every heading, so no button takes a tap.
    expect(tappable()).toEqual([false, false]);
    // jsdom cannot focus a contenteditable, so the focus event goes straight
    // to ProseMirror's own handler, which adds `ProseMirror-focused`.
    editor.view.dom.dispatchEvent(new FocusEvent('focus'));
    editor.commands.setTextSelection(3);
    expect(editor.view.dom.classList.contains('ProseMirror-focused')).toBe(
      true,
    );
    // Caret in the first heading: its button alone is shown, and tappable.
    expect(tappable()).toEqual([true, false]);
    // Caret in the paragraph: hidden again everywhere.
    editor.commands.setTextSelection(editor.state.doc.content.size - 2);
    expect(tappable()).toEqual([false, false]);
    // Readonly: always shown, so always tappable.
    editor.setEditable(false);
    expect(tappable()).toEqual([true, true]);
  });

  it('draws the Form A focus ring', () => {
    const rules = declarations(`${link}:focus-visible`);
    expect(rules['outline']).toBe(
      'var(--mlv-stroke-width-medium) solid var(--mlv-border-focus)',
    );
    expect(rules['outline-offset']).toBe('var(--mlv-focus-ring-offset)');
    expect(rules['opacity']).toBe('1');
  });

  it('fades instantly under reduced motion', () => {
    expect(
      declarations(link, '(prefers-reduced-motion: reduce)')[
        'transition-duration'
      ],
    ).toBe('var(--mlv-duration-instant)');
  });
});
