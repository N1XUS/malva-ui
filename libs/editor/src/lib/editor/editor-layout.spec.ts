import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { fileURLToPath } from 'node:url';
import { Subject } from 'rxjs';
import { compile } from 'sass';
import { vi } from 'vitest';
import { MlvEditorToolbarStartDef, MlvEditorToolbarWidget } from '../..';
import type {
  MlvEditorToolbarAppearance,
  MlvEditorToolbarPosition,
} from '../editor.types';
import { MlvEditor } from './editor';
import {
  createMlvEditorLiveScrollSides,
  mlvEditorCssLength,
  mlvEditorScrollSides,
} from './editor-layout';

@Component({
  imports: [MlvEditor, MlvEditorToolbarStartDef, MlvEditorToolbarWidget],
  template: `
    <mlv-editor
      label="Layout"
      [value]="value()"
      [height]="height()"
      [minHeight]="minHeight()"
      [maxHeight]="maxHeight()"
      [toolbarPosition]="position()"
      [toolbarAppearance]="appearance()"
      [toolbarSticky]="sticky()"
    >
      <button
        mlvEditorToolbarStart
        mlvEditorToolbarWidget
        type="button"
        data-projected-start
      >
        Projected
      </button>
    </mlv-editor>
  `,
})
class LayoutHost {
  readonly value = signal<string | null>('<p>One</p><p>Two</p>');
  readonly height = signal<number | string | undefined>(undefined);
  readonly minHeight = signal<number | string | undefined>(undefined);
  readonly maxHeight = signal<number | string | undefined>(undefined);
  readonly position = signal<MlvEditorToolbarPosition>('top');
  readonly appearance = signal<MlvEditorToolbarAppearance>('bar');
  readonly sticky = signal(false);
  readonly editor = viewChild.required(MlvEditor);
  readonly host = viewChild.required(MlvEditor, { read: ElementRef });
}

async function createLayoutHost(
  providers: unknown[] = [],
): Promise<ComponentFixture<LayoutHost>> {
  await TestBed.configureTestingModule({
    imports: [LayoutHost],
    providers: [provideMlvI18nTesting(), ...(providers as never[])],
  }).compileComponents();
  const fixture = TestBed.createComponent(LayoutHost);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

async function settle(fixture: ComponentFixture<LayoutHost>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function hostOf(fixture: ComponentFixture<LayoutHost>): HTMLElement {
  return fixture.nativeElement.querySelector('mlv-editor') as HTMLElement;
}

interface EditorSheet {
  /** Top-level style rules whose selector list contains `selector` exactly. */
  rules(selector: string): CSSStyleRule[];
  /** Style rules inside `@media <query>` whose selector list contains `selector`. */
  mediaRules(query: string, selector: string): CSSStyleRule[];
  /** Every selector list inside `@media <query>`. */
  mediaSelectors(query: string): string[];
}

/**
 * Compiles `editor.scss` into a live sheet and reads declarations off the
 * CSSOM. jsdom resolves no `var()` and performs no layout, so the stylesheet
 * is the contract these specs pin; geometry is pinned by
 * `libs/editor/e2e/editor-layout.spec.ts`. The path is joined rather than a
 * literal so Vite's `new URL('literal', import.meta.url)` analysis does not
 * rewrite it (same as `editor.spec.ts`).
 */
function withEditorSheet(assertions: (sheet: EditorSheet) => void): void {
  const liveStyle = document.createElement('style');
  liveStyle.textContent = compile(
    fileURLToPath(new URL(['.', 'editor.scss'].join('/'), import.meta.url)),
  ).css;
  document.head.appendChild(liveStyle);
  try {
    const all = [...(liveStyle.sheet?.cssRules ?? [])];
    const matches = (rule: CSSStyleRule, selector: string) =>
      rule.selectorText
        .split(',')
        .map((part) => part.trim())
        .includes(selector);
    const media = (query: string) =>
      all
        .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule)
        .filter((rule) => rule.media.mediaText === query)
        .flatMap((rule) => [...rule.cssRules])
        .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule);
    assertions({
      rules: (selector) =>
        all
          .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
          .filter((rule) => matches(rule, selector)),
      mediaRules: (query, selector) =>
        media(query).filter((rule) => matches(rule, selector)),
      mediaSelectors: (query) => media(query).map((rule) => rule.selectorText),
    });
  } finally {
    liveStyle.remove();
  }
}

/**
 * Non-empty values `property` takes across `rules`. A custom property keeps
 * its source text verbatim in the CSSOM, line breaks included, so whitespace
 * is normalized: the formatter is free to wrap a long `calc()`.
 */
function declared(rules: CSSStyleRule[], property: string): string[] {
  return rules
    .map((rule) =>
      rule.style
        .getPropertyValue(property)
        .replace(/\s+/g, ' ')
        .replace(/\(\s/g, '(')
        .replace(/\s\)/g, ')')
        .trim(),
    )
    .filter((value) => value !== '');
}

describe('mlvEditorCssLength', () => {
  it('writes px for numbers, strings verbatim, and nothing for absent or blank values', () => {
    expect(mlvEditorCssLength(320)).toBe('320px');
    expect(mlvEditorCssLength(0)).toBe('0px');
    expect(mlvEditorCssLength('20rem')).toBe('20rem');
    expect(mlvEditorCssLength('  50vh ')).toBe('50vh');
    expect(mlvEditorCssLength('min(30rem, 60vh)')).toBe('min(30rem, 60vh)');
    expect(mlvEditorCssLength(undefined)).toBeNull();
    expect(mlvEditorCssLength(null)).toBeNull();
    expect(mlvEditorCssLength('')).toBeNull();
    expect(mlvEditorCssLength('   ')).toBeNull();
    expect(mlvEditorCssLength(Number.NaN)).toBeNull();
    expect(mlvEditorCssLength(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('MlvEditor layout inputs', () => {
  it('writes the size custom properties only for resolved inputs', async () => {
    const fixture = await createLayoutHost();
    const host = hostOf(fixture);
    const read = (name: string) => host.style.getPropertyValue(name);

    expect(read('--mlv-editor-height')).toBe('');
    expect(read('--mlv-editor-min-height')).toBe('');
    expect(read('--mlv-editor-max-height')).toBe('');

    fixture.componentInstance.height.set(320);
    fixture.componentInstance.minHeight.set('12rem');
    fixture.componentInstance.maxHeight.set('50vh');
    await settle(fixture);
    expect(read('--mlv-editor-height')).toBe('320px');
    expect(read('--mlv-editor-min-height')).toBe('12rem');
    expect(read('--mlv-editor-max-height')).toBe('50vh');

    fixture.componentInstance.height.set(undefined);
    fixture.componentInstance.minHeight.set('');
    fixture.componentInstance.maxHeight.set(undefined);
    await settle(fixture);
    expect(read('--mlv-editor-height')).toBe('');
    expect(read('--mlv-editor-min-height')).toBe('');
    expect(read('--mlv-editor-max-height')).toBe('');
  });

  it('caps only through height or maxHeight; minHeight alone stays auto', async () => {
    const fixture = await createLayoutHost();
    const host = hostOf(fixture);
    expect(host.classList).not.toContain('mlv-editor--capped');

    fixture.componentInstance.minHeight.set(200);
    await settle(fixture);
    expect(host.classList).not.toContain('mlv-editor--capped');

    fixture.componentInstance.maxHeight.set(240);
    await settle(fixture);
    expect(host.classList).toContain('mlv-editor--capped');

    fixture.componentInstance.maxHeight.set(undefined);
    fixture.componentInstance.height.set('20rem');
    await settle(fixture);
    expect(host.classList).toContain('mlv-editor--capped');

    fixture.componentInstance.height.set('  ');
    await settle(fixture);
    expect(host.classList).not.toContain('mlv-editor--capped');
  });

  it('stamps the toolbar placement modifiers from the inputs', async () => {
    const fixture = await createLayoutHost();
    const host = hostOf(fixture);
    expect(host.classList).toContain('mlv-editor--toolbar-top');
    expect(host.classList).toContain('mlv-editor--toolbar-bar');
    expect(host.classList).not.toContain('mlv-editor--toolbar-sticky');
    expect(fixture.componentInstance.editor().toolbarSticky()).toBe(false);

    fixture.componentInstance.position.set('bottom');
    fixture.componentInstance.appearance.set('floating');
    fixture.componentInstance.sticky.set(true);
    await settle(fixture);
    expect(host.classList).toContain('mlv-editor--toolbar-bottom');
    expect(host.classList).not.toContain('mlv-editor--toolbar-top');
    expect(host.classList).toContain('mlv-editor--toolbar-floating');
    expect(host.classList).not.toContain('mlv-editor--toolbar-bar');
    expect(host.classList).toContain('mlv-editor--toolbar-sticky');
  });
});

describe('MlvEditor layout stylesheet', () => {
  it('makes the viewport a scroll container only when capped', () => {
    withEditorSheet((sheet) => {
      const base = sheet.rules('.mlv-editor__viewport');
      expect(base.length).toBeGreaterThan(0);
      // § 1a: auto mode is neither a scroll container nor a chaining barrier.
      expect(declared(base, 'overflow')).toEqual([]);
      expect(declared(base, 'overflow-y')).toEqual([]);
      expect(declared(base, 'overflow-x')).toEqual([]);
      expect(declared(base, 'overscroll-behavior')).toEqual([]);
      expect(declared(base, 'flex')).toEqual(['1 1 auto']);
      expect(declared(base, 'min-block-size')).toEqual([
        'var(--mlv-editor-min-height, 8rem)',
      ]);

      const capped = sheet.rules('.mlv-editor--capped .mlv-editor__viewport');
      expect(declared(capped, 'overflow')).toEqual(['auto']);
      expect(declared(capped, 'overscroll-behavior')).toEqual(['contain']);
      // The cap wins over the floor, which moves into the scroller (content).
      expect(declared(capped, 'min-block-size')).toEqual(['0']);
      expect(
        declared(
          sheet.rules('.mlv-editor--capped .mlv-editor__content'),
          'min-block-size',
        ),
      ).toEqual([
        'calc(var(--mlv-editor-min-height, 8rem) / var(--mlv-editor-zoom, 1))',
      ]);

      const surface = sheet.rules('.mlv-editor--capped .mlv-editor__surface');
      expect(declared(surface, 'block-size')).toEqual([
        'var(--mlv-editor-height, auto)',
      ]);
      expect(declared(surface, 'max-block-size')).toEqual([
        'var(--mlv-editor-max-height, none)',
      ]);
      // CSS alone never caps: the plain surface reads neither property.
      expect(
        declared(sheet.rules('.mlv-editor__surface'), 'block-size'),
      ).toEqual([]);

      expect(
        declared(sheet.rules('.mlv-editor__content'), 'min-block-size'),
      ).toEqual(['var(--mlv-editor-min-height, 8rem)']);
    });
  });

  it('clips the control container instead of making it a scroll container', () => {
    withEditorSheet((sheet) => {
      const container = sheet.rules(
        '.mlv-editor .mlv-form-control-wrapper__control-container',
      );
      expect(declared(container, 'overflow')).toEqual(['clip']);
    });
  });

  it('keeps print output uncapped and unscrolled', () => {
    withEditorSheet((sheet) => {
      for (const selector of [
        '.mlv-editor__viewport',
        '.mlv-editor--capped .mlv-editor__viewport',
      ]) {
        expect(
          declared(sheet.mediaRules('print', selector), 'overflow'),
        ).toEqual(['visible']);
      }
      const surface = sheet.mediaRules(
        'print',
        '.mlv-editor--capped .mlv-editor__surface',
      );
      expect(declared(surface, 'block-size')).toEqual(['auto']);
      expect(declared(surface, 'max-block-size')).toEqual(['none']);
      for (const selector of [
        '.mlv-editor__content',
        '.mlv-editor--capped .mlv-editor__content',
      ]) {
        expect(
          declared(sheet.mediaRules('print', selector), 'min-block-size'),
        ).toEqual(['0']);
      }
    });
  });

  it('zooms the view layer with CSS zoom: reflow uncapped, magnify capped', () => {
    withEditorSheet((sheet) => {
      const view = sheet.rules('.mlv-editor__view');
      expect(declared(view, 'zoom')).toEqual(['var(--mlv-editor-zoom, 1)']);
      expect(declared(view, 'min-inline-size')).toEqual(['100%']);
      expect(declared(view, 'isolation')).toEqual(['isolate']);
      // No transform, no physical origin, no transition: `zoom` changes the
      // layout size, so the viewport grows instead of scrolling.
      expect(declared(view, 'transform')).toEqual([]);
      expect(declared(view, 'transform-origin')).toEqual([]);
      expect(declared(view, 'transition')).toEqual([]);

      const capped = sheet.rules('.mlv-editor--capped .mlv-editor__view');
      expect(declared(capped, 'inline-size')).toEqual([
        'calc(100% * var(--mlv-editor-zoom, 1))',
      ]);
      expect(declared(capped, 'min-inline-size')).toEqual(['0']);

      const printed = [
        ...sheet.mediaRules('print', '.mlv-editor__view'),
        ...sheet.mediaRules('print', '.mlv-editor--capped .mlv-editor__view'),
      ];
      expect(declared(printed, 'zoom')).toEqual(['1', '1']);
      expect(declared(printed, 'inline-size')).toEqual(['auto', 'auto']);

      expect(
        sheet
          .mediaSelectors('(prefers-reduced-motion: reduce)')
          .some((selector) => selector.includes('.mlv-editor__view')),
      ).toBe(false);
    });
  });

  it('floats a centred pill that overlaps the viewport by the token plus a gap', () => {
    withEditorSheet((sheet) => {
      expect(
        declared(sheet.rules('.mlv-editor'), '--mlv-editor-toolbar-block-size'),
      ).toEqual(['calc(var(--mlv-height-s) + 2 * var(--mlv-spacing-1))']);
      expect(
        declared(
          sheet.rules('.mlv-editor--toolbar-floating'),
          '--mlv-editor-toolbar-overlap',
        ),
      ).toEqual([
        'calc(var(--mlv-editor-toolbar-block-size) + var(--mlv-spacing-2))',
      ]);

      const pill = sheet.rules(
        '.mlv-editor--toolbar-floating .mlv-editor__toolbar',
      );
      expect(declared(pill, 'inline-size')).toEqual(['max-content']);
      expect(declared(pill, 'max-inline-size')).toEqual(['100%']);
      expect(declared(pill, 'min-block-size')).toEqual([
        'var(--mlv-editor-toolbar-block-size)',
      ]);
      expect(declared(pill, 'margin-inline')).toEqual(['auto']);
      expect(declared(pill, 'border')).toEqual(['0']);
      expect(declared(pill, 'border-radius')).toEqual([
        'var(--mlv-radius-panel)',
      ]);
      expect(declared(pill, 'box-shadow')).toEqual([
        'var(--mlv-shadow-floating)',
      ]);
      expect(declared(pill, 'background')).toEqual([
        'var(--mlv-elevation-bg-4)',
      ]);
      expect(declared(pill, 'pointer-events')).toEqual(['auto']);

      const band = sheet.rules(
        '.mlv-editor--toolbar-floating .mlv-editor__toolbar-band',
      );
      expect(declared(band, 'pointer-events')).toEqual(['none']);
      expect(declared(band, 'z-index')).toEqual(['var(--mlv-z-raised)']);

      const top = '.mlv-editor--toolbar-floating.mlv-editor--toolbar-top';
      expect(
        declared(
          sheet.rules(`${top} .mlv-editor__toolbar-band`),
          'margin-block-end',
        ),
      ).toEqual(['calc(-1 * var(--mlv-editor-toolbar-overlap))']);
      expect(
        declared(
          sheet.rules(`${top} .mlv-editor__viewport`),
          'padding-block-start',
        ),
      ).toEqual(['var(--mlv-editor-toolbar-overlap)']);
      expect(
        declared(
          sheet.rules(`${top} .mlv-editor__toolbar-band::before`),
          'mask-image',
        ),
      ).toEqual(['linear-gradient(0deg, transparent, black 2.5rem)']);

      const bottom = '.mlv-editor--toolbar-floating.mlv-editor--toolbar-bottom';
      expect(
        declared(
          sheet.rules(`${bottom} .mlv-editor__toolbar-band`),
          'margin-block-start',
        ),
      ).toEqual(['calc(-1 * var(--mlv-editor-toolbar-overlap))']);
      expect(
        declared(
          sheet.rules(`${bottom} .mlv-editor__viewport`),
          'padding-block-end',
        ),
      ).toEqual(['var(--mlv-editor-toolbar-overlap)']);
      expect(
        declared(
          sheet.rules(`${bottom} .mlv-editor__toolbar-band::before`),
          'mask-image',
        ),
      ).toEqual(['linear-gradient(180deg, transparent, black 2.5rem)']);

      expect(
        declared(
          sheet.mediaRules(
            'print',
            '.mlv-editor--capped .mlv-editor__viewport',
          ),
          'padding-block',
        ),
      ).toEqual(['0']);
    });
  });

  it('pins a sticky band to the offset edge on the toolbar side', () => {
    withEditorSheet((sheet) => {
      const top = sheet.rules(
        '.mlv-editor--toolbar-sticky.mlv-editor--toolbar-top .mlv-editor__toolbar-band',
      );
      expect(declared(top, 'position')).toEqual(['sticky']);
      expect(declared(top, 'inset-block-start')).toEqual([
        'var(--mlv-editor-toolbar-sticky-offset, 0)',
      ]);
      expect(declared(top, 'z-index')).toEqual(['var(--mlv-z-raised)']);

      const bottom = sheet.rules(
        '.mlv-editor--toolbar-sticky.mlv-editor--toolbar-bottom .mlv-editor__toolbar-band',
      );
      expect(declared(bottom, 'position')).toEqual(['sticky']);
      expect(declared(bottom, 'inset-block-end')).toEqual([
        'var(--mlv-editor-toolbar-sticky-offset, 0)',
      ]);
      // Never declared: an app sets it once on an ancestor (OQ4).
      expect(
        declared(
          sheet.rules('.mlv-editor'),
          '--mlv-editor-toolbar-sticky-offset',
        ),
      ).toEqual([]);
    });
  });
});

describe('MlvEditor toolbar position', () => {
  function parts(fixture: ComponentFixture<LayoutHost>) {
    const surface = fixture.nativeElement.querySelector(
      '.mlv-editor__surface',
    ) as HTMLElement;
    return {
      surface,
      band: surface.querySelector(
        ':scope > .mlv-editor__toolbar-band',
      ) as HTMLElement | null,
      viewport: surface.querySelector(
        ':scope > .mlv-editor__viewport',
      ) as HTMLElement,
      status: surface.querySelector(
        ':scope > mlv-editor-image-upload-status',
      ) as HTMLElement | null,
    };
  }

  it('renders the one toolbar before the viewport at the top and after it at the bottom', async () => {
    const fixture = await createLayoutHost();
    let { surface, band, viewport, status } = parts(fixture);
    expect(surface.querySelectorAll('.mlv-editor__toolbar')).toHaveLength(1);
    expect(band?.querySelector(':scope > .mlv-editor__toolbar')).not.toBeNull();
    expect(
      (band?.compareDocumentPosition(viewport) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fixture.componentInstance.position.set('bottom');
    await settle(fixture);
    ({ surface, band, viewport, status } = parts(fixture));
    expect(surface.querySelectorAll('.mlv-editor__toolbar')).toHaveLength(1);
    // Content → toolbar, so Tab order matches the visual order (WCAG 2.4.3);
    // the band follows the viewport directly so its overlap margin lands on
    // it, and the upload status comes after.
    expect(viewport.nextElementSibling).toBe(band);
    expect(band?.nextElementSibling).toBe(status);
  });

  it('keeps projected toolbar content through a position change', async () => {
    const fixture = await createLayoutHost();
    const projected = fixture.nativeElement.querySelector(
      '[data-projected-start]',
    ) as HTMLElement;
    expect(projected.closest('.mlv-editor__toolbar')).not.toBeNull();

    fixture.componentInstance.position.set('bottom');
    await settle(fixture);
    const after = fixture.nativeElement.querySelector(
      '[data-projected-start]',
    ) as HTMLElement;
    expect(after).toBe(projected);
    expect(after.closest('.mlv-editor__toolbar-band')).not.toBeNull();
  });

  it('draws the bar hairline toward the content on either side', () => {
    withEditorSheet((sheet) => {
      const bar = sheet.rules('.mlv-editor__toolbar');
      expect(declared(bar, 'border-bottom')).toEqual([]);
      expect(declared(bar, 'border-block-end')).toEqual([
        'var(--mlv-stroke-width) solid var(--mlv-border-normal)',
      ]);
      const bottom = sheet.rules(
        '.mlv-editor--toolbar-bottom .mlv-editor__toolbar',
      );
      expect(declared(bottom, 'border-block-start')).toEqual([
        'var(--mlv-stroke-width) solid var(--mlv-border-normal)',
      ]);
      expect(declared(bottom, 'border-block-end')).toEqual(['0']);
      expect(
        declared(sheet.rules('.mlv-editor__toolbar-band'), 'flex-direction'),
      ).toEqual(['column']);
      expect(
        declared(
          sheet.mediaRules('print', '.mlv-editor__toolbar-band'),
          'display',
        ),
      ).toEqual(['none']);
    });
  });
});

describe('MlvEditor narrow measure target', () => {
  it('decides narrow mode from the surface in every appearance, never from the toolbar root', async () => {
    const observed = new Map<Element, Subject<ResizeObserverEntry[]>>();
    const fixture = await createLayoutHost([
      {
        provide: MlvResizeObserverService,
        useValue: {
          observe: (target: Element | ElementRef<Element>) => {
            const element =
              target instanceof ElementRef ? target.nativeElement : target;
            let subject = observed.get(element);
            if (!subject) {
              subject = new Subject<ResizeObserverEntry[]>();
              observed.set(element, subject);
            }
            return subject.asObservable();
          },
        },
      },
    ]);
    const surface = fixture.nativeElement.querySelector(
      '.mlv-editor__surface',
    ) as HTMLElement;
    const root = () =>
      fixture.nativeElement.querySelector(
        '.mlv-editor__toolbar',
      ) as HTMLElement;
    const emit = (width: number) => {
      observed
        .get(surface)
        ?.next([{ contentRect: { width } } as unknown as ResizeObserverEntry]);
      fixture.detectChanges();
    };

    expect(observed.has(surface)).toBe(true);
    expect(observed.has(root())).toBe(false);
    emit(500);
    expect(root().classList).toContain('mlv-editor-toolbar--narrow');
    emit(900);
    expect(root().classList).not.toContain('mlv-editor-toolbar--narrow');

    // A content-hugging pill would un-narrow itself if it measured itself.
    fixture.componentInstance.appearance.set('floating');
    await settle(fixture);
    emit(500);
    expect(root().classList).toContain('mlv-editor-toolbar--narrow');
    expect(observed.has(root())).toBe(false);

    // A position change re-creates the root; the new one measures the surface too.
    fixture.componentInstance.position.set('bottom');
    await settle(fixture);
    emit(900);
    expect(root().classList).not.toContain('mlv-editor-toolbar--narrow');
    expect(observed.has(root())).toBe(false);
  });
});

describe('mlvEditorScrollSides', () => {
  it('adds the obscured extent on the toolbar side only', () => {
    expect(mlvEditorScrollSides('margin', 'top', 0)).toEqual({
      top: 5,
      right: 5,
      bottom: 5,
      left: 5,
    });
    expect(mlvEditorScrollSides('threshold', 'top', 0)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(mlvEditorScrollSides('margin', 'top', 59.2)).toEqual({
      top: 65,
      right: 5,
      bottom: 5,
      left: 5,
    });
    expect(mlvEditorScrollSides('threshold', 'bottom', 59.2)).toEqual({
      top: 0,
      right: 0,
      bottom: 60,
      left: 0,
    });
    expect(mlvEditorScrollSides('margin', 'bottom', -3)).toEqual({
      top: 5,
      right: 5,
      bottom: 5,
      left: 5,
    });
  });

  it('re-resolves on every read, as ProseMirror reads value[side] per scroll', () => {
    let obscured = 10;
    const live = createMlvEditorLiveScrollSides(
      'margin',
      () => 'top',
      () => obscured,
    );
    expect(live.top).toBe(15);
    obscured = 40;
    expect(live.top).toBe(45);
    expect(live.bottom).toBe(5);
  });
});

describe('MlvEditor scroll props (WCAG 2.2 SC 2.4.11)', () => {
  it('hands ProseMirror a margin and threshold that clear the toolbar per configuration', async () => {
    const fixture = await createLayoutHost();
    const host = fixture.componentInstance;
    const sides = (name: 'scrollMargin' | 'scrollThreshold') => {
      const view = host.editor().editor()?.view;
      if (!view) throw new Error('Expected a mounted Tiptap view.');
      const value = view.someProp(name) as {
        top: number;
        right: number;
        bottom: number;
        left: number;
      };
      return {
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        left: value.left,
      };
    };
    const stubBand = (height: number, inset?: [string, string]) => {
      const band = fixture.nativeElement.querySelector(
        '.mlv-editor__toolbar-band',
      ) as HTMLElement;
      vi.spyOn(band, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, 600, height),
      );
      if (inset) band.style.setProperty(inset[0], inset[1]);
    };

    // Docked bar, not sticky: nothing overlaps the content → ProseMirror defaults.
    stubBand(45);
    expect(sides('scrollMargin')).toEqual({
      top: 5,
      right: 5,
      bottom: 5,
      left: 5,
    });
    expect(sides('scrollThreshold')).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    // The first sync has run. ProseMirror's `setProps` merges into the live
    // view, but Tiptap's `setOptions` replaces its stored `editorProps`, which
    // a later `mount()` builds the view from, so the stored copy must keep
    // the props too.
    const stored = host.editor().editor()?.options.editorProps as
      | { scrollMargin?: { top: number }; scrollThreshold?: { top: number } }
      | undefined;
    expect(stored?.scrollMargin?.top).toBe(5);
    expect(stored?.scrollThreshold?.top).toBe(0);

    // Floating in a capped editor: the band overlaps the scrolling viewport.
    host.appearance.set('floating');
    host.maxHeight.set(240);
    await settle(fixture);
    stubBand(60);
    expect(sides('scrollMargin')).toEqual({
      top: 65,
      right: 5,
      bottom: 5,
      left: 5,
    });
    expect(sides('scrollThreshold')).toEqual({
      top: 60,
      right: 0,
      bottom: 0,
      left: 0,
    });

    // Floating, uncapped, not sticky: the editor never scrolls internally and
    // the band scrolls away with the page, so nothing is obscured.
    host.maxHeight.set(undefined);
    await settle(fixture);
    expect(sides('scrollMargin').top).toBe(5);

    // Sticky bar: the band plus its offset, at every scroll ancestor.
    host.appearance.set('bar');
    host.sticky.set(true);
    await settle(fixture);
    stubBand(45, ['inset-block-start', '12px']);
    expect(sides('scrollMargin')).toEqual({
      top: 62,
      right: 5,
      bottom: 5,
      left: 5,
    });
    expect(sides('scrollThreshold').top).toBe(57);

    // Capped + sticky, the accepted limitation (#416 OQ11): ProseMirror applies
    // one margin at every scroll ancestor, so the capped viewport also keeps
    // the caret band + offset from its edge, not 5, even while the band is not
    // stuck over it. It errs toward visibility.
    host.maxHeight.set(240);
    await settle(fixture);
    stubBand(45, ['inset-block-start', '12px']);
    expect(sides('scrollMargin').top).toBe(62);
    expect(sides('scrollThreshold').top).toBe(57);
    host.maxHeight.set(undefined);
    await settle(fixture);

    // Bottom floating sticky: the band is re-created, the other side takes it.
    host.position.set('bottom');
    host.appearance.set('floating');
    await settle(fixture);
    stubBand(60, ['inset-block-end', '7px']);
    expect(sides('scrollMargin')).toEqual({
      top: 5,
      right: 5,
      bottom: 72,
      left: 5,
    });
    expect(sides('scrollThreshold')).toEqual({
      top: 0,
      right: 0,
      bottom: 67,
      left: 0,
    });
  });

  it('has no axe violations in every position × appearance combination', async () => {
    const fixture = await createLayoutHost();
    const host = fixture.componentInstance;
    for (const position of ['top', 'bottom'] as const) {
      for (const appearance of ['bar', 'floating'] as const) {
        host.position.set(position);
        host.appearance.set(appearance);
        host.sticky.set(appearance === 'floating');
        host.maxHeight.set(position === 'bottom' ? 240 : undefined);
        await settle(fixture);
        await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
      }
    }
  }, 30_000);
});
