import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import type Postcss from 'postcss';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { describe, expect, it } from 'vitest';

// `sass` and `postcss` are Node-only; `createRequire` keeps them out of the
// browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const postcss = nodeRequire('postcss') as typeof Postcss;

// Resolved from this file: the `@nx/vitest:test` executor runs from the root.
const HERE = dirname(fileURLToPath(import.meta.url));

/** A component stylesheet as the browser receives it, layers flattened. */
function compile(file: string): Postcss.Root {
  return postcss.parse(
    stripCssLayersFromText(sass.compile(resolve(HERE, file)).css),
  );
}

/** Whitespace-collapsed selectors of `rule`. */
const selectorsOf = (rule: Postcss.Rule): string[] =>
  rule.selectors.map((selector) => selector.replace(/\s+/g, ' ').trim());

/** Declarations the given roots give exactly `selector`, later ones winning. */
function declarations(
  roots: readonly Postcss.Root[],
  selector: string,
): Record<string, string> {
  const found: Record<string, string> = {};
  let emitted = false;
  for (const root of roots) {
    root.walkRules((rule) => {
      if (!selectorsOf(rule).includes(selector)) return;
      emitted = true;
      rule.each((node) => {
        if (node.type === 'decl') found[node.prop] = node.value;
      });
    });
  }
  expect(emitted, `rule "${selector}" is emitted`).toBe(true);
  return found;
}

/** The stylesheets #516 adds, by the block each one styles. */
const CLEAN_SHEETS = {
  'mlv-editor-ai-improve': compile('../ai/editor-ai-improve.scss'),
  'mlv-editor-ai-prompt': compile('../ai/editor-ai-prompt.scss'),
  'mlv-editor-block-type': compile('./editor-block-type.scss'),
  'mlv-editor-bubble-groups': compile('./editor-bubble-groups.scss'),
  'mlv-editor-bubble-more': compile('./editor-bubble-more.scss'),
  'mlv-editor-insert-menu': compile('../insert/editor-insert-menu.scss'),
  // The clean gutter styles blocks `mlv-editor` owns, so every rule is keyed
  // on the clean modifier instead of a block of its own.
  'mlv-editor--toolbar-clean': compile('../insert/editor-clean-gutter.scss'),
} as const;

/**
 * Selectors a clean stylesheet may carry outside its own block: each is a
 * copy of a rule `main` already ships, pinned equal below, so it changes
 * nothing for `'bar'` / `'floating'`.
 */
const SHARED_SELECTORS = ['.mlv-editor-toolbar__submenu-chevron'];

const PHYSICAL_INLINE =
  /^(margin|padding|border)-(left|right)|^(left|right)$|^border-(top|bottom)-(left|right)-radius$/;

describe('clean appearance stylesheets (#516)', () => {
  it('scope every rule to their own block, adding nothing to the bar or floating toolbar', () => {
    for (const [block, root] of Object.entries(CLEAN_SHEETS)) {
      root.walkRules((rule) => {
        for (const selector of selectorsOf(rule)) {
          const own = selector.startsWith(`.${block}`);
          expect(
            own || SHARED_SELECTORS.includes(selector),
            `${block}: "${selector}"`,
          ).toBe(true);
        }
      });
    }
  });

  it('keep the submenu chevron rule identical to the bar overflow copy', () => {
    const overflow = compile('./editor-toolbar-overflow.scss');
    expect(
      declarations(
        [CLEAN_SHEETS['mlv-editor-bubble-more']],
        '.mlv-editor-toolbar__submenu-chevron',
      ),
    ).toEqual(declarations([overflow], '.mlv-editor-toolbar__submenu-chevron'));
  });

  it('hide the three self-hiding hosts despite their author display', () => {
    for (const block of [
      'mlv-editor-ai-improve',
      'mlv-editor-block-type',
      'mlv-editor-bubble-more',
    ] as const) {
      expect(declarations([CLEAN_SHEETS[block]], `.${block}`)['display']).toBe(
        'inline-flex',
      );
      expect(
        declarations([CLEAN_SHEETS[block]], `.${block}[hidden]`)['display'],
      ).toBe('none');
    }
  });

  it('keep the groups host out of layout and the prompt anchor inert', () => {
    expect(
      declarations(
        [CLEAN_SHEETS['mlv-editor-bubble-groups']],
        '.mlv-editor-bubble-groups',
      )['display'],
    ).toBe('contents');
    expect(
      declarations(
        [CLEAN_SHEETS['mlv-editor-ai-prompt']],
        '.mlv-editor-ai-prompt__anchor',
      ),
    ).toEqual({
      position: 'fixed',
      display: 'block',
      'pointer-events': 'none',
    });
  });

  it('bound the block-type label and write the inline axis logically', () => {
    expect(
      declarations(
        [CLEAN_SHEETS['mlv-editor-block-type']],
        '.mlv-editor-block-type__label',
      ),
    ).toMatchObject({
      'min-inline-size': '8rem',
      'max-inline-size': '12rem',
      'text-align': 'start',
      'text-overflow': 'ellipsis',
    });
    for (const root of Object.values(CLEAN_SHEETS)) {
      root.walkDecls((decl) => {
        expect(PHYSICAL_INLINE.test(decl.prop), decl.toString()).toBe(false);
        if (decl.prop === 'text-align') {
          expect(['start', 'end', 'center']).toContain(decl.value);
        }
      });
    }
  });

  describe('clean gutter (#516, U6)', () => {
    const gutter = CLEAN_SHEETS['mlv-editor--toolbar-clean'];

    /** Declarations of `selector` in `media` (`null`: outside any at-rule). */
    function inMedia(
      selector: string,
      media: string | null,
    ): Record<string, string> {
      const found: Record<string, string> = {};
      gutter.walkRules((rule) => {
        const parent = rule.parent;
        const params =
          parent?.type === 'atrule' ? (parent as Postcss.AtRule).params : null;
        if (params !== media || !selectorsOf(rule).includes(selector)) return;
        rule.each((node) => {
          if (node.type === 'decl') found[node.prop] = node.value;
        });
      });
      return found;
    }

    const HOST = '.mlv-editor--toolbar-clean.mlv-editor';
    const HANDLE = '.mlv-editor--toolbar-clean .mlv-editor__block-handle';
    const ADD = '.mlv-editor--toolbar-clean .mlv-editor__block-add';
    const TARGET = '.mlv-editor--toolbar-clean .mlv-editor__block-target';

    it('doubles the gutter into two 1.5rem slots and never shrinks a slot below 1.5rem (SC 2.5.8)', () => {
      expect(inMedia(HOST, null)).toEqual({
        '--mlv-editor-gutter-slot': 'var(--mlv-spacing-6)',
        '--mlv-editor-gutter': 'calc(2 * var(--mlv-editor-gutter-slot))',
      });
      gutter.walkDecls('--mlv-editor-gutter-slot', (decl) => {
        expect(decl.value, decl.toString()).toBe('var(--mlv-spacing-6)');
      });
      // Touch: the handle is hidden, so the "+" alone takes one slot.
      expect(inMedia(HOST, '(hover: none)')['--mlv-editor-gutter']).toBe(
        'var(--mlv-editor-gutter-slot)',
      );
    });

    it('puts the "+" in the outer slot and the handle in the inner one, both on the logical inline-start side', () => {
      const add = inMedia(ADD, null);
      const handle = inMedia(HANDLE, null);
      expect(add['inset-inline-start']).toBeDefined();
      expect(handle['inset-inline-start']).toBeDefined();
      expect(add['inline-size']).toBe('var(--mlv-editor-gutter-slot)');
      expect(handle['inline-size']).toBe('var(--mlv-editor-gutter-slot)');
      // The handle sits exactly one slot further in than the "+".
      expect(handle['inset-inline-start'].replace(/\s+/g, '')).toBe(
        `calc(${add['inset-inline-start']
          .replace(/\s+/g, '')
          .replace(/^calc\((.*)\)$/, '$1')}+var(--mlv-editor-gutter-slot))`,
      );
      expect(inMedia(TARGET, null)['inset-inline']).toBeDefined();
    });

    it('hides the "+" and the target in print', () => {
      expect(inMedia(ADD, 'print')['display']).toBe('none');
      expect(inMedia(TARGET, 'print')['display']).toBe('none');
    });
  });

  it('style the shared prompt panel exactly as the AI menu did before the move', () => {
    const roots = [
      compile('../ai/editor-ai-menu.scss'),
      compile('../ai/editor-ai-prompt-panel.scss'),
    ];
    expect(declarations(roots, '.mlv-editor-ai-menu__panel')).toEqual({
      display: 'grid',
      // Sass folds the source's `calc()` into `min()`, before the move too.
      width: 'min(22rem, 100vw - 3.5rem)',
      gap: 'var(--mlv-spacing-1-5)',
      padding: 'var(--mlv-spacing-2)',
    });
    expect(declarations(roots, '.mlv-editor-ai-menu__actions')).toEqual({
      display: 'flex',
      'flex-wrap': 'wrap',
      'justify-content': 'flex-end',
      gap: 'var(--mlv-spacing-3)',
    });
  });
});

describe('table of contents stylesheet (#516, U9)', () => {
  const toc = compile('../toc/editor-toc.scss');

  it('writes the inline axis logically, so the list mirrors under any [dir]', () => {
    toc.walkDecls((decl) => {
      expect(PHYSICAL_INLINE.test(decl.prop), decl.toString()).toBe(false);
      if (decl.prop === 'text-align') {
        expect(['start', 'end']).toContain(decl.value);
      }
    });
    expect(declarations([toc], '.mlv-editor-toc__link--active')).toMatchObject({
      'border-inline-start-color': 'var(--mlv-border-focus)',
    });
  });

  it('keeps every rule on its own block', () => {
    toc.walkRules((rule) => {
      for (const selector of selectorsOf(rule)) {
        expect(selector, selector).toMatch(/\bmlv-editor-toc(__|--|\b)/);
      }
    });
  });

  it('gives content headings a scroll margin consumers can override', () => {
    const editor = compile('../editor/editor.scss');
    let margin: string | undefined;
    editor.walkRules((rule) => {
      if (!selectorsOf(rule).some((selector) => selector.endsWith(' h2')))
        return;
      rule.walkDecls('scroll-margin-block-start', (decl) => {
        margin = decl.value.replace(/\s+/g, ' ');
      });
    });
    expect(margin).toBe(
      'var(--mlv-editor-heading-scroll-margin, var(--mlv-spacing-4))',
    );
  });
});
