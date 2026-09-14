import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT } from '@angular/common';
import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MlvDensityService } from '@malva-ui/cdk/density';
import { MlvThemeService } from '@malva-ui/cdk/theme';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import { ExampleContainerComponent } from './example-container.component';
import { ShikiHighlightService } from '../shiki-highlight.service';

@Component({ template: '<p>Live example</p>' })
class PreviewComponent {}

describe('ExampleContainerComponent', () => {
  const createFixture = (highlight = vi.fn().mockResolvedValue('<pre />')) => {
    const copy = vi.fn().mockReturnValue(true);
    const fixture = TestBed.configureTestingModule({
      imports: [ExampleContainerComponent],
      providers: [
        provideRouter([]),
        provideMlvI18nTesting(),
        { provide: Clipboard, useValue: { copy } },
        {
          provide: MlvThemeService,
          useValue: { currentTheme: signal('light') },
        },
        {
          provide: ShikiHighlightService,
          useValue: { highlight },
        },
      ],
    }).createComponent(ExampleContainerComponent);
    fixture.componentRef.setInput('component', PreviewComponent);
    return { fixture, highlight, copy };
  };

  const query = <T extends Element>(
    fixture: { nativeElement: HTMLElement },
    selector: string,
  ) => fixture.nativeElement.querySelector(selector) as T;

  const sourcesToggle = (fixture: { nativeElement: HTMLElement }) =>
    query<HTMLButtonElement>(fixture, '.example-container__sources-toggle');

  /**
   * Renders the deferred control bar. The bar sits in an `@defer (on viewport)`
   * block, `TestBed` leaves defer blocks in their placeholder state by default
   * (`DeferBlockBehavior.Manual`), and the real trigger needs an
   * `IntersectionObserver` jsdom does not have — so a spec that drives a
   * switcher renders the block itself rather than switching the whole fixture
   * to `Playthrough`.
   */
  const renderControls = async (
    fixture: ComponentFixture<ExampleContainerComponent>,
  ) => {
    const [controls] = await fixture.getDeferBlocks();
    await controls.render(DeferBlockState.Complete);
    await fixture.whenStable();
  };

  it('renders no expansion control without a registered route', async () => {
    const { fixture } = createFixture();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(query(fixture, '.example-container__open-full')).toBeNull();
  });

  it('renders a normal router link for a registered full example', async () => {
    const { fixture } = createFixture();
    fixture.componentRef.setInput(
      'fullExampleRoute',
      '/showcases/data-operations',
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const link = query<HTMLAnchorElement>(
      fixture,
      '.example-container__open-full',
    );

    expect(link.textContent).toContain('Open full example');
    expect(link.getAttribute('href')).toContain('/showcases/data-operations');
  });

  it('contains no native fullscreen API usage', () => {
    // Resolved from this spec's own location, not `process.cwd()`: the target
    // runs from the workspace root, so a cwd-relative path misses the file.
    // `join(dirname(fileURLToPath(import.meta.url)), …)` rather than
    // `new URL(…, import.meta.url)`, which Vite rewrites into an asset URL.
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        'example-container.component.ts',
      ),
      'utf8',
    );

    expect(source).not.toContain('requestFullscreen');
    expect(source).not.toContain('exitFullscreen');
    expect(source).not.toContain('fullscreenchange');
  });

  it('offers the playground for an example whose source can stand alone', async () => {
    const { fixture } = createFixture();
    fixture.componentRef.setInput('heading', 'Button');
    fixture.componentRef.setInput('content', {
      TypeScript: `import { Component } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-basic-example',
  imports: [MlvButton],
  template: '<button mlvButton>Save</button>',
})
export default class ButtonBasicExampleComponent {}
`,
    });
    fixture.detectChanges();
    await fixture.whenStable();

    await vi.waitFor(() =>
      expect(query(fixture, '.open-in-playground')).not.toBeNull(),
    );
  });

  it('withholds the playground from an example that imports docs-local code', async () => {
    const { fixture } = createFixture();
    fixture.componentRef.setInput('content', {
      TypeScript: `import { Component } from '@angular/core';
import { DocsInspectorComponent } from '../../../../shared';

@Component({
  selector: 'docs-checkbox-basic-example',
  imports: [DocsInspectorComponent],
  template: '<docs-inspector />',
})
export default class CheckboxBasicExampleComponent {}
`,
    });
    fixture.detectChanges();
    await fixture.whenStable();

    await vi.waitFor(() =>
      expect(fixture.componentInstance.resolvedFiles()).toHaveLength(1),
    );
    expect(query(fixture, '.open-in-playground')).toBeNull();
  });

  describe('preview and sources', () => {
    const tabLabels = (fixture: { nativeElement: HTMLElement }) =>
      Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')).map(
        (tab) => tab.textContent?.trim(),
      );

    const tabNamed = (fixture: { nativeElement: HTMLElement }, label: string) =>
      Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')).find(
        (tab) => tab.textContent?.trim() === label,
      ) as HTMLElement;

    const openSources = async (fixture: {
      nativeElement: HTMLElement;
      detectChanges(): void;
      whenStable(): Promise<unknown>;
    }) => {
      sourcesToggle(fixture).click();
      fixture.detectChanges();
      await fixture.whenStable();
    };

    it('always shows the preview, and never as a tab', async () => {
      const { fixture } = createFixture();
      fixture.componentRef.setInput('content', {
        TypeScript: 'const ready = true;',
      });
      fixture.detectChanges();
      await vi.waitFor(() =>
        expect(fixture.componentInstance.resolvedFiles()).toHaveLength(1),
      );
      await openSources(fixture);

      // The preview band is a sibling of the source tabs, not a panel inside
      // them — that Preview tab is exactly what this redesign removes.
      expect(query(fixture, '.example-container__preview p')?.textContent).toBe(
        'Live example',
      );
      expect(
        query(fixture, 'mlv-tab-content .example-container__preview'),
      ).toBeNull();
      expect(tabLabels(fixture)).not.toContain('Preview');
    });

    it('discloses the sources through one expandable toggle', async () => {
      const { fixture } = createFixture();
      fixture.componentRef.setInput('content', {
        TypeScript: 'const ready = true;',
        HTML: '<button>Ready</button>',
      });
      fixture.detectChanges();
      await vi.waitFor(() =>
        expect(fixture.componentInstance.resolvedFiles()).toHaveLength(2),
      );

      const toggle = sourcesToggle(fixture);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.getAttribute('aria-controls')).toBe(
        query(fixture, 'mlv-expand').getAttribute('id'),
      );
      expect(query(fixture, '.example-container__source')).toBeNull();

      await openSources(fixture);

      expect(sourcesToggle(fixture).getAttribute('aria-expanded')).toBe('true');
      expect(query(fixture, '.example-container__source')).not.toBeNull();
    });

    it('lays the source files out as tabs inside the disclosure', async () => {
      const { fixture } = createFixture();
      fixture.componentRef.setInput('content', {
        TypeScript: 'const ready = true;',
        HTML: '<button>Ready</button>',
      });
      fixture.detectChanges();
      await vi.waitFor(() =>
        expect(fixture.componentInstance.resolvedFiles()).toHaveLength(2),
      );
      await openSources(fixture);

      const group = query(fixture, 'mlv-expand mlv-tab-group');
      expect(group).not.toBeNull();
      expect(group.querySelector('[role="tablist"]')).not.toBeNull();
      expect(tabLabels(fixture)).toEqual(['TypeScript', 'HTML']);
    });

    it('builds no tab group for an example that resolved no sources', async () => {
      const { fixture } = createFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      await openSources(fixture);

      // An empty group would still paint its own separator and header band, so
      // the disclosure has to open onto nothing at all.
      expect(fixture.componentInstance.resolvedFiles()).toHaveLength(0);
      expect(query(fixture, 'mlv-tab-group')).toBeNull();
    });

    it('renders one source pane at a time and swaps it on tab activation', async () => {
      const { fixture } = createFixture();
      fixture.componentRef.setInput('content', {
        TypeScript: 'const ready = true;',
        HTML: '<button>Ready</button>',
      });
      fixture.detectChanges();
      await vi.waitFor(() =>
        expect(fixture.componentInstance.resolvedFiles()).toHaveLength(2),
      );
      await openSources(fixture);

      const panes = () =>
        fixture.nativeElement.querySelectorAll('.example-container__source');
      expect(panes()).toHaveLength(1);
      expect(panes()[0].textContent).toContain('const ready = true;');

      const htmlTab = Array.from(
        fixture.nativeElement.querySelectorAll('[role="tab"]'),
      ).find((tab) => tab.textContent?.trim() === 'HTML') as HTMLElement;
      htmlTab.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(panes()).toHaveLength(1);
      expect(panes()[0].textContent).toContain('<button>Ready</button>');
    });

    it('keeps the tab the reader picked across a close and reopen', async () => {
      const { fixture } = createFixture();
      fixture.componentRef.setInput('content', {
        TypeScript: 'const ready = true;',
        HTML: '<button>Ready</button>',
      });
      fixture.detectChanges();
      await vi.waitFor(() =>
        expect(fixture.componentInstance.resolvedFiles()).toHaveLength(2),
      );
      await openSources(fixture);

      tabNamed(fixture, 'HTML').click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(tabNamed(fixture, 'HTML').getAttribute('aria-selected')).toBe(
        'true',
      );

      // `mlv-expand` renders its body inside `@if (opened())`, so the lazy
      // outlet — the tab group with it — is destroyed on close and rebuilt on
      // the next open. That is the whole reason `activeSource` lives on the
      // component: a signal owned by the panel template would hand the reader
      // back to the first tab every time they collapsed it.
      await openSources(fixture);
      expect(query(fixture, '.example-container__source')).toBeNull();

      await openSources(fixture);

      expect(tabNamed(fixture, 'HTML').getAttribute('aria-selected')).toBe(
        'true',
      );
      // And the pane behind it is the HTML one. Asserted through the copy
      // control's name rather than the pane text: the second open finds a warm
      // Shiki entry, so the pane renders highlighted markup and its
      // `textContent` is whatever the (stubbed) highlighter produced.
      expect(
        query(
          fixture,
          '.example-container__source docs-copy-source button',
        )?.getAttribute('aria-label'),
      ).toBe('Copy HTML source');
    });

    it('swaps the toggle chevron and label with the expanded state', async () => {
      const { fixture } = createFixture();
      fixture.componentRef.setInput('content', {
        TypeScript: 'const ready = true;',
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(query(fixture, '[data-chevron="down"]')).not.toBeNull();
      expect(query(fixture, '[data-chevron="up"]')).toBeNull();
      expect(sourcesToggle(fixture).textContent?.trim()).toBe('Show sources');

      sourcesToggle(fixture).click();
      await fixture.whenStable();

      expect(query(fixture, '[data-chevron="up"]')).not.toBeNull();
      expect(query(fixture, '[data-chevron="down"]')).toBeNull();
      // `aria-expanded` alone would read "Show sources, expanded"; the label
      // names what pressing it does now, as the chevron already does.
      expect(sourcesToggle(fixture).textContent?.trim()).toBe('Hide sources');
    });

    it('highlights only the open tab, and only once the sources are opened', async () => {
      const { fixture, highlight } = createFixture();
      fixture.componentRef.setInput('content', {
        TypeScript: 'const ready = true;',
        HTML: '<button>Ready</button>',
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.sourcesOpen()).toBe(false);
      await vi.waitFor(() =>
        expect(fixture.componentInstance.resolvedFiles()).toHaveLength(2),
      );
      expect(highlight).not.toHaveBeenCalled();

      await openSources(fixture);
      await vi.waitFor(() => expect(highlight).toHaveBeenCalledTimes(1));

      // Only the pane the reader can see: the other tab's panel is not in the
      // DOM, so tokenizing it would be invisible work.
      expect(highlight).toHaveBeenCalledWith(
        'const ready = true;',
        'typescript',
        'light',
      );

      const htmlTab = Array.from(
        fixture.nativeElement.querySelectorAll('[role="tab"]'),
      ).find((tab) => tab.textContent?.trim() === 'HTML') as HTMLElement;
      htmlTab.click();
      fixture.detectChanges();
      await vi.waitFor(() => expect(highlight).toHaveBeenCalledTimes(2));

      expect(highlight).toHaveBeenCalledWith(
        '<button>Ready</button>',
        'html',
        'light',
      );
    });

    it('gives the open source pane its own copy control', async () => {
      const { fixture, copy } = createFixture();
      fixture.componentRef.setInput('content', {
        TypeScript: 'const ready = true;',
        HTML: '<button>Ready</button>',
      });
      fixture.detectChanges();
      await vi.waitFor(() =>
        expect(fixture.componentInstance.resolvedFiles()).toHaveLength(2),
      );
      await openSources(fixture);

      const buttons = () =>
        fixture.nativeElement.querySelectorAll(
          '.example-container__source docs-copy-source button',
        ) as NodeListOf<HTMLButtonElement>;
      expect(buttons()).toHaveLength(1);

      buttons()[0].click();
      expect(copy).toHaveBeenCalledWith('const ready = true;');

      const htmlTab = Array.from(
        fixture.nativeElement.querySelectorAll('[role="tab"]'),
      ).find((tab) => tab.textContent?.trim() === 'HTML') as HTMLElement;
      htmlTab.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // The control belongs to the pane, so it copies whatever that pane shows.
      buttons()[0].click();
      expect(copy).toHaveBeenCalledWith('<button>Ready</button>');
    });

    /**
     * The rules of the injected stylesheet that declares the copy control's
     * hover reveal, in source order. The container is `ViewEncapsulation.None`,
     * so Angular writes its `styles` into a plain `<style>` in the document and
     * CSSOM reads them back verbatim.
     *
     * Read as rules rather than through `getComputedStyle`, because jsdom
     * cannot resolve this one: it matches selectors with nwsapi, whose
     * `:focus-within` matches only the focused element **itself** —
     * `isFocusable(e)` returns `e` when `e === document.activeElement` and
     * `false` otherwise, and nothing walks descendants — so a focused button
     * inside the pane leaves `pane.matches(':focus-within')` false and the rule
     * unapplied. The rendered behaviour was verified in Chromium instead.
     */
    const revealSheetRules = () => {
      for (const sheet of Array.from(document.styleSheets)) {
        const rules = Array.from(sheet.cssRules);
        if (
          rules.some(
            (rule) =>
              rule instanceof CSSStyleRule &&
              rule.selectorText === '.example-container__source-copy',
          )
        ) {
          return rules;
        }
      }
      throw new Error('the container stylesheet is not in the document');
    };

    it('reveals the hover-only copy control on focus as well as hover', async () => {
      const { fixture } = createFixture();
      fixture.componentRef.setInput('content', {
        TypeScript: 'const ready = true;',
      });
      fixture.detectChanges();
      await vi.waitFor(() =>
        expect(fixture.componentInstance.resolvedFiles()).toHaveLength(1),
      );
      await openSources(fixture);

      // The premise, which jsdom does resolve: the control ships invisible.
      expect(
        getComputedStyle(
          query<HTMLElement>(fixture, '.example-container__source-copy'),
        ).opacity,
      ).toBe('0');

      // So `:focus-within` on the pane is the only thing standing between a
      // keyboard reader and a focused control they cannot see — WCAG 2.4.11.
      // Narrow the reveal to `:hover` alone and this goes red.
      const rules = revealSheetRules();
      const base = rules.findIndex(
        (rule) =>
          rule instanceof CSSStyleRule &&
          rule.selectorText === '.example-container__source-copy',
      );
      const reveal = rules.findIndex(
        (rule) =>
          rule instanceof CSSStyleRule &&
          rule.style.opacity === '1' &&
          rule.selectorText.includes(
            '.example-container__source:focus-within .example-container__source-copy',
          ),
      );

      expect(reveal).toBeGreaterThan(-1);
      expect(
        (rules[reveal] as CSSStyleRule).selectorText.includes(
          '.example-container__source:hover .example-container__source-copy',
        ),
      ).toBe(true);
      // (0,3,0) over (0,1,0) already decides it; order is pinned so a later
      // rule cannot quietly take the reveal back.
      expect(reveal).toBeGreaterThan(base);
    });

    it('shows the copy control unconditionally where there is no hover to reveal it', async () => {
      const { fixture } = createFixture();
      fixture.componentRef.setInput('content', {
        TypeScript: 'const ready = true;',
      });
      fixture.detectChanges();
      await vi.waitFor(() =>
        expect(fixture.componentInstance.resolvedFiles()).toHaveLength(1),
      );
      await openSources(fixture);

      // A coarse pointer never hovers, so on touch the reveal has to be off.
      const fallback = revealSheetRules().find(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.conditionText.replace(/\s/g, '') === '(hover:none)',
      );

      expect(fallback).toBeDefined();
      const inner = Array.from(fallback?.cssRules ?? []).find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.selectorText === '.example-container__source-copy',
      );
      expect(inner?.style.opacity).toBe('1');
    });
  });

  describe('per-example switchers', () => {
    it('defers the bar until the example is on screen', async () => {
      // 10 examples on `/button`, 23 on `/data-table`, and every one of them is
      // rebuilt on every navigation. Eager, the bars were 42 `mlv-segmented`s
      // and 100 tooltip directives — 38% of the page's elements — and the whole
      // page waited for them. Measured in Chromium over 6 routed navigations
      // (median): `/button` 107.4ms → 74.7ms, `/data-table` 214.7ms → 147.7ms,
      // with the initial element count falling 1553 → 1147 and 6843 → 5683.
      const { fixture } = createFixture();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(query(fixture, 'docs-example-controls')).toBeNull();
      expect(
        query(fixture, '.example-container__controls-placeholder'),
      ).not.toBeNull();

      await renderControls(fixture);

      expect(query(fixture, 'docs-example-controls')).not.toBeNull();
      expect(
        query(fixture, '.example-container__controls-placeholder'),
      ).toBeNull();
    });

    const pick = async (
      fixture: { nativeElement: HTMLElement; whenStable(): Promise<unknown> },
      switcher: string,
      value: string,
    ) => {
      (
        fixture.nativeElement.querySelector(
          `[data-switcher="${switcher}"] [value="${value}"]`,
        ) as HTMLButtonElement
      ).click();
      await fixture.whenStable();
    };

    it('seeds each switcher from the page-level setting', async () => {
      const { fixture } = createFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      await renderControls(fixture);

      const stage = query<HTMLElement>(fixture, '.example-container__stage');
      expect(stage.getAttribute('dir')).toBe(
        TestBed.inject(MlvRtlService).direction(),
      );
      expect(stage.getAttribute('mlvTheme')).toBe('light');
      expect(
        stage.classList.contains(
          `mlv--${TestBed.inject(MlvDensityService).density()}`,
        ),
      ).toBe(true);
    });

    it('scopes theme, direction and density to the stage, never the document', async () => {
      const { fixture } = createFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      await renderControls(fixture);

      await pick(fixture, 'theme', 'dark');
      await pick(fixture, 'direction', 'rtl');
      await pick(fixture, 'density', 'compact');

      const stage = query<HTMLElement>(fixture, '.example-container__stage');
      expect(stage.getAttribute('mlvTheme')).toBe('dark');
      expect(stage.getAttribute('dir')).toBe('rtl');
      expect(stage.classList.contains('mlv--compact')).toBe(true);

      const document = TestBed.inject(DOCUMENT);
      expect(document.documentElement.getAttribute('dir')).not.toBe('rtl');
      expect(document.documentElement.getAttribute('mlvTheme')).not.toBe(
        'dark',
      );
      expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');
      expect(TestBed.inject(MlvDensityService).density()).toBe('comfortable');
    });

    it('pins the preview width to the chosen viewport', async () => {
      const { fixture } = createFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      await renderControls(fixture);

      expect(
        query<HTMLElement>(
          fixture,
          '.example-container__preview',
        ).classList.contains('example-container__preview--desktop'),
      ).toBe(true);

      await pick(fixture, 'viewport', 'mobile');

      expect(
        query<HTMLElement>(
          fixture,
          '.example-container__preview',
        ).classList.contains('example-container__preview--mobile'),
      ).toBe(true);
    });
  });

  it('has no axe violations with the sources open', async () => {
    const { fixture } = createFixture();
    fixture.componentRef.setInput('content', {
      TypeScript: 'const ready = true;',
    });
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(fixture.componentInstance.resolvedFiles()).toHaveLength(1),
    );
    // The bar is deferred, so the sweep would otherwise cover a placeholder.
    await renderControls(fixture);

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);

    fixture.componentInstance.sourcesOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
